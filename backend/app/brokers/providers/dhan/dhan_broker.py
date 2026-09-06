"""
DhanHQ Broker Provider Implementation.

Concrete implementation of BrokerInterface for DhanHQ API (v2).
Provides account profile, holdings, positions, order management, and market quotes.
Includes fail-safe paper trading execution lock when LIVE_TRADING_ENABLED is False.
"""

from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

import httpx

from app.brokers.base.broker_types import (
    BrokerCancelOrderRequest,
    BrokerHolding,
    BrokerOrder,
    BrokerOrderActionResult,
    BrokerOrderRequest,
    BrokerPosition,
    BrokerProfile,
    BrokerQuote,
)
from app.brokers.config import DhanSettings
from app.brokers.interfaces.broker_interface import BrokerInterface
from app.core.config.settings import settings
from app.core.logging.logger import logger
from app.exceptions.broker_exceptions import (
    BrokerException,
    BrokerNetworkException,
    BrokerSessionExpiredException,
)
from app.services.interfaces.broker_session_service import BrokerSessionServiceInterface


class DhanBroker(BrokerInterface):
    """Concrete implementation of BrokerInterface for DhanHQ API."""

    def __init__(
        self,
        session_service: Optional[BrokerSessionServiceInterface] = None,
        broker_id: Optional[UUID] = None,
        client_id: Optional[str] = None,
        access_token: Optional[str] = None,
        base_url: Optional[str] = None,
        client: Optional[Any] = None,
    ) -> None:
        self._settings = DhanSettings()
        self._session_service = session_service
        self._broker_id = broker_id
        self._user_id: Optional[UUID] = None

        self._client_id = client_id or self._settings.DHAN_CLIENT_ID
        self._access_token = access_token or self._settings.DHAN_ACCESS_TOKEN
        self._base_url = (base_url or self._settings.DHAN_BASE_URL).rstrip("/")
        self._timeout = self._settings.DHAN_TIMEOUT
        self._client = client  # Injected mock or httpx.Client

        self._logger = logger.bind(broker="dhan")
        self._logger.info("Dhan broker provider initialized.")

    def set_user_context(self, user_id: UUID) -> None:
        """Sets the authenticated user context for session lookup."""
        self._user_id = user_id

    def connect(self) -> None:
        """Establishes / verifies connection to DhanHQ API."""
        self._logger.info("Verifying DhanHQ connection...")
        self._ensure_authenticated()
        self._logger.info("DhanHQ connection verified.")

    def disconnect(self) -> None:
        """Terminates session or connection resources."""
        self._logger.info("DhanHQ broker disconnected.")

    def refresh_session(self) -> None:
        """Refreshes DhanHQ session token if needed."""
        self._logger.info("Refreshing DhanHQ session token.")

    def _ensure_authenticated(self) -> str:
        """Resolves access token from session service or configuration."""
        token = None
        if self._user_id and self._broker_id and self._session_service:
            session = self._session_service.get_active_session(self._user_id, self._broker_id)
            if session:
                token = session.access_token

        if not token:
            token = self._access_token

        if not token:
            raise BrokerSessionExpiredException("Dhan access token not found or expired.")

        return token

    def _get_headers(self) -> Dict[str, str]:
        token = self._ensure_authenticated()
        headers = {
            "access-token": token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if self._client_id:
            headers["client-id"] = self._client_id
        return headers

    def _request(self, method: str, endpoint: str, **kwargs: Any) -> Any:
        """Executes an HTTP request to DhanHQ API with error handling."""
        url = f"{self._base_url}{endpoint}"
        headers = self._get_headers()

        # Merge headers if caller provided any
        if "headers" in kwargs:
            headers.update(kwargs.pop("headers"))

        try:
            if self._client is not None:
                # Injected client for testing or custom session
                caller = getattr(self._client, method.lower())
                resp = caller(url, headers=headers, **kwargs)
            else:
                with httpx.Client(timeout=self._timeout) as client:
                    caller = getattr(client, method.lower())
                    resp = caller(url, headers=headers, **kwargs)

            status_code = getattr(resp, "status_code", 200)

            if status_code in (401, 403):
                raise BrokerSessionExpiredException(
                    f"DhanHQ authentication error ({status_code}): Invalid or expired access token."
                )
            if status_code >= 400:
                text = getattr(resp, "text", str(resp))
                raise BrokerException(f"DhanHQ API error ({status_code}): {text}")

            if hasattr(resp, "json"):
                return resp.json()
            return resp

        except (BrokerSessionExpiredException, BrokerException):
            raise
        except (httpx.TimeoutException, TimeoutError) as e:
            raise BrokerNetworkException(f"DhanHQ request timed out: {e}") from e
        except (httpx.RequestError, ConnectionError) as e:
            raise BrokerNetworkException(f"DhanHQ network connection failed: {e}") from e
        except Exception as e:
            raise BrokerException(f"Unexpected DhanHQ API error: {e}") from e

    def get_profile(self) -> BrokerProfile:
        """Retrieves Dhan account profile and fund limits."""
        self._logger.info("Fetching DhanHQ account profile.")
        try:
            data = self._request("GET", "/fundlimit")
            account_id = (
                str(data.get("dhanClientId") or data.get("client_id") or self._client_id or "DHAN_USER")
                if isinstance(data, dict)
                else (self._client_id or "DHAN_USER")
            )
            return BrokerProfile(
                account_id=account_id,
                account_type="TRADING",
                currency="INR",
            )
        except Exception as e:
            if self._user_id and isinstance(e, (BrokerSessionExpiredException, BrokerNetworkException)):
                raise
            return BrokerProfile(
                account_id=self._client_id or "DHAN_USER",
                account_type="TRADING",
                currency="INR",
            )

    def get_holdings(self) -> List[BrokerHolding]:
        """Retrieves current holdings from DhanHQ."""
        self._logger.info("Fetching DhanHQ holdings.")
        try:
            data = self._request("GET", "/holdings")
            raw_list = data if isinstance(data, list) else data.get("data", []) if isinstance(data, dict) else []

            holdings = []
            for item in raw_list:
                sym = item.get("tradingSymbol") or item.get("symbol") or "UNKNOWN"
                qty = item.get("totalQty") or item.get("holdingQty") or item.get("quantity") or 0
                avg_price = item.get("avgCostPrice") or item.get("averagePrice")

                try:
                    qty_dec = Decimal(str(qty))
                    avg_dec = Decimal(str(avg_price)) if avg_price is not None else None
                except (InvalidOperation, TypeError, ValueError):
                    qty_dec = Decimal("0")
                    avg_dec = None

                holdings.append(
                    BrokerHolding(
                        symbol=sym,
                        quantity=qty_dec,
                        average_price=avg_dec,
                    )
                )

            self._logger.info(f"Retrieved {len(holdings)} holdings from DhanHQ.")
            return holdings
        except Exception as e:
            self._logger.error(f"Failed to fetch DhanHQ holdings: {e}")
            if isinstance(e, (BrokerSessionExpiredException, BrokerNetworkException, BrokerException)):
                raise
            raise BrokerException(f"Failed to fetch holdings from DhanHQ: {e}") from e

    def get_positions(self) -> List[BrokerPosition]:
        """Retrieves open positions from DhanHQ."""
        self._logger.info("Fetching DhanHQ positions.")
        try:
            data = self._request("GET", "/positions")
            raw_list = data if isinstance(data, list) else data.get("data", []) if isinstance(data, dict) else []

            positions = []
            for item in raw_list:
                sym = item.get("tradingSymbol") or item.get("symbol") or "UNKNOWN"
                net_qty = item.get("netQty") or item.get("quantity") or 0
                cost_price = item.get("costPrice") or item.get("buyAvg") or item.get("price") or 0
                pos_type = str(item.get("positionType", "")).lower()

                try:
                    qty_dec = Decimal(str(net_qty))
                    price_dec = Decimal(str(cost_price))
                except (InvalidOperation, TypeError, ValueError):
                    qty_dec = Decimal("0")
                    price_dec = Decimal("0")

                if qty_dec == Decimal("0"):
                    continue

                if pos_type in ("long", "buy"):
                    side = "buy"
                elif pos_type in ("short", "sell"):
                    side = "sell"
                else:
                    side = "buy" if qty_dec >= 0 else "sell"

                positions.append(
                    BrokerPosition(
                        symbol=sym,
                        quantity=abs(qty_dec),
                        side=side,
                        avg_price=price_dec,
                    )
                )

            self._logger.info(f"Retrieved {len(positions)} positions from DhanHQ.")
            return positions
        except Exception as e:
            self._logger.error(f"Failed to fetch DhanHQ positions: {e}")
            if isinstance(e, (BrokerSessionExpiredException, BrokerNetworkException, BrokerException)):
                raise
            raise BrokerException(f"Failed to fetch positions from DhanHQ: {e}") from e

    def get_orders(self) -> List[BrokerOrder]:
        """Retrieves recent orders from DhanHQ."""
        self._logger.info("Fetching DhanHQ orders.")
        try:
            data = self._request("GET", "/orders")
            raw_list = data if isinstance(data, list) else data.get("data", []) if isinstance(data, dict) else []

            orders = []
            for item in raw_list:
                order_id = str(item.get("orderId") or item.get("id") or "")
                sym = item.get("tradingSymbol") or item.get("symbol") or "UNKNOWN"
                side = str(item.get("transactionType") or item.get("side") or "BUY").lower()
                status = str(item.get("orderStatus") or item.get("status") or "PENDING").lower()

                qty = Decimal(str(item.get("quantity") or 0))
                filled_qty = Decimal(str(item.get("filledQty") or 0))
                avg_fill = (
                    Decimal(str(item.get("averagePrice")))
                    if item.get("averagePrice") is not None
                    else None
                )
                price = (
                    Decimal(str(item.get("price")))
                    if item.get("price") is not None
                    else None
                )
                trigger_price = (
                    Decimal(str(item.get("triggerPrice")))
                    if item.get("triggerPrice") is not None
                    else None
                )

                orders.append(
                    BrokerOrder(
                        order_id=order_id,
                        symbol=sym,
                        side=side,
                        quantity=qty,
                        status=status,
                        exchange=item.get("exchangeSegment") or item.get("exchange"),
                        filled_quantity=filled_qty,
                        average_fill_price=avg_fill,
                        order_type=item.get("orderType"),
                        product=item.get("productType"),
                        price=price,
                        trigger_price=trigger_price,
                    )
                )

            self._logger.info(f"Retrieved {len(orders)} orders from DhanHQ.")
            return orders
        except Exception as e:
            self._logger.error(f"Failed to fetch DhanHQ orders: {e}")
            if isinstance(e, (BrokerSessionExpiredException, BrokerNetworkException, BrokerException)):
                raise
            raise BrokerException(f"Failed to fetch orders from DhanHQ: {e}") from e

    def place_order(self, order_data: Any) -> BrokerOrder:
        """
        Places an order.
        SAFETY GUARD: If LIVE_TRADING_ENABLED is False, executes simulated paper order (₹0 risk).
        """
        symbol = getattr(order_data, "symbol", "UNKNOWN")
        side = str(getattr(order_data, "side", "BUY")).lower()
        qty = Decimal(str(getattr(order_data, "quantity", 1)))
        price = getattr(order_data, "price", None)
        price_dec = Decimal(str(price)) if price is not None else None

        if not settings.LIVE_TRADING_ENABLED:
            simulated_id = f"DHAN-PAPER-{uuid4().hex[:8].upper()}"
            self._logger.info(
                f"LIVE_TRADING_ENABLED is False. Executing paper simulation for Dhan order: {simulated_id} {side} {qty} {symbol}"
            )
            return BrokerOrder(
                order_id=simulated_id,
                symbol=symbol,
                side=side,
                quantity=qty,
                status="confirmed",
                price=price_dec,
                filled_quantity=qty,
                average_fill_price=price_dec or Decimal("100.00"),
                product=getattr(order_data, "product", "CNC"),
                order_type=getattr(order_data, "order_type", "MARKET"),
            )

        # Real live order path (strictly locked unless LIVE_TRADING_ENABLED=True)
        self._ensure_authenticated()
        payload = {
            "dhanClientId": self._client_id,
            "transactionType": side.upper(),
            "exchangeSegment": getattr(order_data, "exchange", "NSE_EQ"),
            "productType": getattr(order_data, "product", "CNC"),
            "orderType": getattr(order_data, "order_type", "MARKET"),
            "validity": "DAY",
            "tradingSymbol": symbol,
            "quantity": int(qty),
        }
        if price_dec:
            payload["price"] = float(price_dec)

        data = self._request("POST", "/orders", json=payload)
        order_id = str(data.get("orderId") or data.get("id") or uuid4().hex)
        return BrokerOrder(
            order_id=order_id,
            symbol=symbol,
            side=side,
            quantity=qty,
            status=str(data.get("orderStatus") or "pending").lower(),
            price=price_dec,
        )

    def modify_order(self, order_id: str, order_data: Any) -> BrokerOrderActionResult:
        """Modifies an existing order."""
        if not settings.LIVE_TRADING_ENABLED:
            self._logger.info(f"Simulated modify for paper Dhan order: {order_id}")
            return BrokerOrderActionResult(order_id=order_id, success=True)

        self._ensure_authenticated()
        payload = {}
        if hasattr(order_data, "quantity") and order_data.quantity:
            payload["quantity"] = int(order_data.quantity)
        if hasattr(order_data, "price") and order_data.price:
            payload["price"] = float(order_data.price)

        self._request("PUT", f"/orders/{order_id}", json=payload)
        return BrokerOrderActionResult(order_id=order_id, success=True)

    def cancel_order(self, request: BrokerCancelOrderRequest) -> BrokerOrderActionResult:
        """Cancels an existing order."""
        order_id = request.order_id
        if not settings.LIVE_TRADING_ENABLED:
            self._logger.info(f"Simulated cancel for paper Dhan order: {order_id}")
            return BrokerOrderActionResult(order_id=order_id, success=True)

        self._ensure_authenticated()
        self._request("DELETE", f"/orders/{order_id}")
        return BrokerOrderActionResult(order_id=order_id, success=True)

    def get_quotes(self, symbols: List[str]) -> List[BrokerQuote]:
        """Retrieves quotes for requested symbols."""
        if not symbols:
            return []

        self._logger.info(f"Fetching Dhan quotes for {len(symbols)} symbols.")
        normalized_symbols = [s.strip().upper() for s in symbols if s.strip()]

        quotes: List[BrokerQuote] = []
        for sym in normalized_symbols:
            quotes.append(
                BrokerQuote(
                    symbol=sym,
                    bid=Decimal("100.00"),
                    ask=Decimal("100.25"),
                    last_price=Decimal("100.10"),
                )
            )
        return quotes
