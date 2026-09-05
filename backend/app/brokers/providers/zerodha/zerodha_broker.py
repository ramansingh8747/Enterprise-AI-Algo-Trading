from typing import List, Any, Optional
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from zoneinfo import ZoneInfo
from decimal import Decimal
from uuid import UUID
from kiteconnect import KiteConnect
from kiteconnect.exceptions import KiteException, TokenException, OrderException, NetworkException
from app.brokers.interfaces.broker_interface import BrokerInterface
from app.brokers.base.broker_types import (
    BrokerProfile, BrokerHolding, BrokerPosition, BrokerOrder, BrokerQuote,
    BrokerOrderRequest, BrokerOrderActionResult, BrokerCancelOrderRequest
)
from app.brokers.config import ZerodhaSettings
from app.core.logging.logger import logger
from app.core.config.settings import settings
from app.services.interfaces.broker_session_service import BrokerSessionServiceInterface
from app.exceptions.auth_exceptions import UnauthorizedException
from app.exceptions.broker_exceptions import (
    BrokerSessionExpiredException, BrokerOrderException, BrokerNetworkException, BrokerException
)
from app.brokers.providers.zerodha.zerodha_order_mapper import ZerodhaOrderMapper

class ZerodhaBroker(BrokerInterface):
    """Concrete implementation of BrokerInterface for Zerodha."""

    def __init__(
        self,
        session_service: BrokerSessionServiceInterface,
        broker_id: UUID,
        client: Optional[Any] = None
    ) -> None:
        self._settings = ZerodhaSettings()
        self._session_service = session_service
        self._broker_id = broker_id
        self._user_id: Optional[UUID] = None

        # Initialize KiteConnect client
        self._client = client or KiteConnect(api_key=self._settings.ZERODHA_API_KEY)

        if not client and self._settings.ZERODHA_BASE_URL:
            self._client.root = self._settings.ZERODHA_BASE_URL

        self._logger = logger.bind(broker="zerodha")
        self._logger.info("Zerodha SDK client created.")

    def set_user_context(self, user_id: UUID) -> None:
        """Set user context for authenticated operations."""
        self._user_id = user_id

    def _ensure_authenticated(self) -> None:
        """Fetch token from session service and authenticate client."""
        if not self._user_id:
            raise BrokerException("User context not set for authenticated operations.")

        session = self._session_service.get_active_session(self._user_id, self._broker_id)
        if not session:
            raise BrokerSessionExpiredException("Broker session not found or expired.")
        self._client.set_access_token(session.access_token)

    def _clear_access_token(self) -> None:
        """Clear the access token from the SDK client instance."""
        self._client.set_access_token(None)

    def _sdk_call(self, method_name: str, *args: Any, **kwargs: Any) -> Any:
        """Execute a synchronous broker SDK call with a bounded timeout.

        A timeout is fail-closed: the caller must reconcile broker state before
        attempting any new order. We deliberately do not retry order operations.
        """
        method = getattr(self._client, method_name)
        executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="zerodha-sdk")
        future = executor.submit(method, *args, **kwargs)
        try:
            result = future.result(timeout=settings.BROKER_OPERATION_TIMEOUT_SECONDS)
            executor.shutdown(wait=True, cancel_futures=False)
            return result
        except FutureTimeoutError as exc:
            # Do not wait for a potentially stuck network call. For order
            # placement this means the outcome is UNKNOWN; callers must reconcile
            # broker state and must not automatically retry.
            future.cancel()
            executor.shutdown(wait=False, cancel_futures=True)
            raise BrokerNetworkException(
                f"Zerodha operation '{method_name}' timed out after "
                f"{settings.BROKER_OPERATION_TIMEOUT_SECONDS:.1f}s. "
                "Broker state must be reconciled before retrying."
            ) from exc
        except Exception:
            executor.shutdown(wait=False, cancel_futures=True)
            raise

    def _translate_exception(self, e: Exception) -> Exception:
        """Translate SDK exceptions to domain exceptions."""
        if isinstance(e, TokenException):
            # Invalidate the persisted session so future operations fail closed
            # instead of repeatedly sending an expired access token.
            try:
                if self._user_id:
                    session = self._session_service.get_active_session(self._user_id, self._broker_id)
                    if session:
                        self._session_service.revoke_session(session.id)
            except Exception:
                self._logger.warning("Unable to revoke expired Zerodha session.", exc_info=True)
            return BrokerSessionExpiredException(str(e))
        if isinstance(e, OrderException):
            return BrokerOrderException(str(e))
        if isinstance(e, NetworkException):
            return BrokerNetworkException(str(e))
        if isinstance(e, KiteException):
            return BrokerException(str(e))
        if isinstance(e, ValueError): # Validation errors
            return BrokerOrderException(str(e))
        return BrokerException(f"Broker error occurred: {e}")

    def connect(self, request_token: str) -> None:
        """Exchange a request token and persist the encrypted access session."""
        if not self._user_id:
            raise UnauthorizedException("User context is required before connecting Zerodha.")
        if not request_token:
            raise UnauthorizedException("Zerodha request token is required.")

        self._logger.info("Connecting Zerodha...")
        try:
            session_data = self._sdk_call(
                "generate_session",
                request_token,
                api_secret=self._settings.ZERODHA_API_SECRET,
            )
            access_token = session_data.get("access_token")
            if not access_token:
                raise BrokerSessionExpiredException("Zerodha did not return an access token.")

            self._client.set_access_token(access_token)
            # Zerodha daily sessions expire at the next India-market calendar day boundary.
            now_ist = datetime.now(ZoneInfo("Asia/Kolkata"))
            next_midnight_ist = (now_ist + timedelta(days=1)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            expires_at = next_midnight_ist.astimezone(timezone.utc)
            self._session_service.create_or_update_session(
                user_id=self._user_id,
                broker_id=self._broker_id,
                access_token=access_token,
                expires_at=expires_at,
            )
            self._logger.info("Zerodha session established and persisted.")
        except Exception as e:
            self._clear_access_token()
            raise self._translate_exception(e)

    def disconnect(self) -> None:
        """Revoke the active persisted session and clear the SDK token."""
        if not self._user_id:
            self._clear_access_token()
            return

        session = self._session_service.get_active_session(self._user_id, self._broker_id)
        if session:
            self._session_service.revoke_session(session.id)
        self._clear_access_token()

    def refresh_session(self) -> None:
        """Zerodha sessions cannot be refreshed with an access-token refresh call."""
        raise BrokerException(
            "Session refresh not supported. Please re-authenticate."
        )

    def get_profile(self) -> BrokerProfile:
        """Get the user profile from Zerodha."""
        self._ensure_authenticated()
        try:
            self._logger.info("Fetching Zerodha profile...")
            profile_data = self._sdk_call("profile")

            return BrokerProfile(
                account_id=profile_data["user_id"],
                account_type=profile_data["user_type"],
                currency=None
            )
        except Exception as e:
            self._logger.error(f"Failed to fetch Zerodha profile.")
            raise self._translate_exception(e)
        finally:
            self._clear_access_token()

    def get_holdings(self) -> List[BrokerHolding]:
        """Get the current holdings from Zerodha."""
        self._ensure_authenticated()
        try:
            self._logger.info("Fetching Zerodha holdings...")
            holdings_data = self._sdk_call("holdings")

            holdings = []
            for holding in holdings_data:
                holdings.append(
                    BrokerHolding(
                        symbol=holding["tradingsymbol"],
                        quantity=Decimal(str(holding["quantity"])),
                        average_price=Decimal(str(holding["average_price"]))
                    )
                )

            self._logger.info(f"Successfully fetched {len(holdings)} holdings.")
            return holdings
        except Exception as e:
            self._logger.error(f"Failed to fetch Zerodha holdings.")
            raise self._translate_exception(e)
        finally:
            self._clear_access_token()

    def get_positions(self) -> List[BrokerPosition]:
        """Get the current net positions from Zerodha."""
        self._ensure_authenticated()
        try:
            self._logger.info("Fetching Zerodha positions...")
            positions_data = self._sdk_call("positions")
            net_positions = positions_data.get("net", [])

            positions = []
            for pos in net_positions:
                if pos["quantity"] == 0:
                    continue

                positions.append(
                    BrokerPosition(
                        symbol=pos["tradingsymbol"],
                        quantity=Decimal(str(abs(pos["quantity"]))),
                        side="buy" if pos["quantity"] > 0 else "sell",
                        avg_price=Decimal(str(pos["average_price"]))
                    )
                )

            self._logger.info(f"Successfully fetched {len(positions)} net positions.")
            return positions
        except Exception as e:
            self._logger.error(f"Failed to fetch Zerodha positions.")
            raise self._translate_exception(e)
        finally:
            self._clear_access_token()

    def get_orders(self) -> List[BrokerOrder]:
        """Get the current orders from Zerodha."""
        self._ensure_authenticated()
        try:
            self._logger.info("Fetching Zerodha orders...")
            orders_data = self._sdk_call("orders")

            orders = []
            for order in orders_data:
                orders.append(
                    BrokerOrder(
                        order_id=order["order_id"],
                        symbol=order["tradingsymbol"],
                        side=order["transaction_type"].lower(),
                        quantity=Decimal(str(order["quantity"])),
                        status=order["status"].lower(),
                        exchange=order.get("exchange"),
                        filled_quantity=Decimal(str(order.get("filled_quantity") or 0)),
                        average_fill_price=(Decimal(str(order["average_price"])) if order.get("average_price") is not None else None),
                        order_type=order.get("order_type"),
                        product=order.get("product"),
                        variety=order.get("variety"),
                        price=(Decimal(str(order["price"])) if order.get("price") is not None else None),
                        trigger_price=(Decimal(str(order["trigger_price"])) if order.get("trigger_price") is not None else None),
                    )
                )

            self._logger.info(f"Successfully fetched {len(orders)} orders.")
            return orders
        except Exception as e:
            self._logger.error(f"Failed to fetch Zerodha orders.")
            raise self._translate_exception(e)
        finally:
            self._clear_access_token()

    def place_order(self, order_data: BrokerOrderRequest) -> BrokerOrder:
        """Place a new order on Zerodha."""
        self._ensure_authenticated()
        try:
            self._logger.info(f"Placing Zerodha order: symbol={order_data.symbol}")

            # Use mapper
            params = ZerodhaOrderMapper.map_to_sdk_params(order_data)
            order_id = self._sdk_call("place_order", **params)

            self._logger.info(f"Order placed successfully: order_id={order_id}")

            return BrokerOrder(
                order_id=order_id,
                symbol=order_data.symbol,
                side=order_data.side.lower(),
                quantity=order_data.quantity,
                status="unknown"
            )
        except Exception as e:
            self._logger.error(f"Failed to place Zerodha order: {e}")
            raise self._translate_exception(e)
        finally:
            self._clear_access_token()

    def modify_order(self, order_id: str, order_data: BrokerOrderRequest) -> BrokerOrderActionResult:
        """Modify an existing order on Zerodha."""
        self._ensure_authenticated()
        try:
            self._logger.info(f"Modifying Zerodha order: order_id={order_id}")

            # Use mapper
            params = ZerodhaOrderMapper.map_modify_to_sdk_params(order_id, order_data)
            modified_order_id = self._sdk_call("modify_order", **params)

            self._logger.info(f"Order modified successfully: order_id={modified_order_id}")

            return BrokerOrderActionResult(
                order_id=modified_order_id,
                success=True
            )
        except Exception as e:
            self._logger.error(f"Failed to modify Zerodha order: {e}")
            raise self._translate_exception(e)
        finally:
            self._clear_access_token()

    def cancel_order(self, request: BrokerCancelOrderRequest) -> BrokerOrderActionResult:
        """Cancel an existing order on Zerodha."""
        self._ensure_authenticated()
        try:
            self._logger.info(f"Cancelling Zerodha order: order_id={request.order_id}")

            # Use mapper
            params = ZerodhaOrderMapper.map_cancel_to_sdk_params(request)
            cancelled_order_id = self._sdk_call("cancel_order", **params)

            self._logger.info(f"Order cancelled successfully: order_id={cancelled_order_id}")

            return BrokerOrderActionResult(
                order_id=cancelled_order_id,
                success=True
            )
        except Exception as e:
            self._logger.error(f"Failed to cancel Zerodha order: {e}")
            raise self._translate_exception(e)
        finally:
            self._clear_access_token()

    def get_quotes(self, symbols: List[str]) -> List[BrokerQuote]:
        """Get market quotes for specified symbols."""
        self._ensure_authenticated()
        if not symbols:
            return []

        try:
            self._logger.info(f"Fetching quotes for {len(symbols)} symbols.")
            data = self._sdk_call("quote", *symbols)

            quotes = []
            for symbol in symbols:
                if symbol not in data:
                    self._logger.warning(f"No quote data for symbol: {symbol}")
                    continue

                quote_data = data[symbol]

                depth = quote_data.get("depth", {})
                buy_depth = depth.get("buy", [])
                sell_depth = depth.get("sell", [])

                if not buy_depth or not sell_depth:
                    raise BrokerException(f"Missing depth data (bid/ask) for symbol: {symbol}.")

                bid = Decimal(str(buy_depth[0]["price"]))
                ask = Decimal(str(sell_depth[0]["price"]))
                last_price = Decimal(str(quote_data["last_price"]))

                # Zerodha quote payload exposes the previous close under OHLC.
                # Derive percentage change server-side so automated strategies
                # never depend on frontend/demo market data.
                change_percent = None
                previous_close = (quote_data.get("ohlc") or {}).get("close")
                if previous_close is not None:
                    previous_close_decimal = Decimal(str(previous_close))
                    if previous_close_decimal > 0:
                        change_percent = ((last_price - previous_close_decimal) / previous_close_decimal) * Decimal("100")

                quotes.append(
                    BrokerQuote(
                        symbol=symbol,
                        bid=bid,
                        ask=ask,
                        last_price=last_price,
                        change_percent=change_percent,
                    )
                )

            self._logger.info(f"Successfully fetched {len(quotes)} quotes.")
            return quotes
        except Exception as e:
            self._logger.error(f"Failed to fetch Zerodha quotes.")
            raise self._translate_exception(e)
        finally:
            self._clear_access_token()
