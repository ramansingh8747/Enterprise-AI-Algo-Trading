from typing import List, Optional, Any, Dict
from uuid import UUID
from decimal import Decimal

from app.brokers.factory import BrokerFactory
from app.brokers.interfaces.broker_interface import BrokerInterface
from app.brokers.base.broker_types import (
    BrokerOrder, BrokerOrderRequest, BrokerOrderActionResult, BrokerCancelOrderRequest
)
from app.services.interfaces.broker_session_service import BrokerSessionServiceInterface
from app.services.broker_service import BrokerService
from app.services.idempotency_service import IdempotencyService


from app.services.risk_engine import RiskEngine
from app.services.trading_safety_service import TradingSafetyService
from app.database.repositories.broker_order_repository import BrokerOrderRepository
from app.services.execution_position_service import ExecutionPositionService
from app.services.event_bus.trading_events import TradingEventPublisher
from app.services.event_bus.models import EventType
from app.core.logging.trading_audit import audit_event
from app.exceptions.strategy_exceptions import ExecutionPolicyViolationException


class BrokerOrderService:
    """
    Orchestration service for broker order operations.
    Integrates session lookup, provider factory instantiation, user context setting,
    idempotency deduplication, pre-trade risk engine validation, and delegation to concrete BrokerInterface implementations.
    """

    def __init__(
        self,
        session_service: BrokerSessionServiceInterface,
        broker_service: BrokerService,
        broker_factory: type[BrokerFactory] = BrokerFactory,
        idempotency_service: Optional[IdempotencyService] = None,
        risk_engine: Optional[RiskEngine] = None,
        safety_service: Optional[TradingSafetyService] = None,
        order_repository: Optional[BrokerOrderRepository] = None,
        execution_position_service: Optional[ExecutionPositionService] = None,
        trading_event_publisher: Optional[TradingEventPublisher] = None,
    ) -> None:
        self._session_service = session_service
        self._broker_service = broker_service
        self._broker_factory = broker_factory
        self._idempotency_service = idempotency_service
        self._risk_engine = risk_engine
        self._safety_service = safety_service
        self._order_repository = order_repository
        self._execution_position_service = execution_position_service
        self._trading_event_publisher = trading_event_publisher

    def _emit_order_event(self, event_type: EventType, *, user_id: UUID, broker_id: UUID, order: BrokerOrder, payload: Optional[Dict[str, Any]] = None, strategy_instance_id: Optional[UUID] = None) -> None:
        if not self._trading_event_publisher:
            return
        self._trading_event_publisher.emit(
            event_type,
            user_id=user_id,
            broker_id=broker_id,
            strategy_instance_id=strategy_instance_id,
            symbol=order.symbol,
            execution_mode="LIVE",
            payload={
                "order_id": order.order_id,
                "status": order.status,
                "quantity": str(order.quantity),
                **(payload or {}),
            },
        )

    def _get_provider(
        self,
        user_id: UUID,
        broker_id: UUID,
        client: Optional[Any] = None
    ) -> BrokerInterface:
        """
        Resolves broker configuration and retrieves an initialized provider instance with user context.
        """
        broker = self._broker_service.get_broker(broker_id)
        provider_name = getattr(broker, "broker_name", None) or getattr(broker, "broker_type", None)

        provider = self._broker_factory.get_provider(
            provider_name=provider_name,
            session_service=self._session_service,
            broker_id=broker_id,
            client=client
        )

        if hasattr(provider, "set_user_context"):
            provider.set_user_context(user_id)

        return provider

    def _validate_risk(
        self,
        user_id: UUID,
        broker_id: UUID,
        request: BrokerOrderRequest,
        provider: Optional[BrokerInterface] = None,
    ) -> None:
        """Run the unified LIVE safety boundary and server-side risk checks."""
        current_positions = None
        current_exposure = None
        if provider is not None:
            current_positions = provider.get_positions()
            current_exposure = Decimal("0")
            for pos in current_positions or []:
                if isinstance(pos, dict):
                    qty = pos.get("quantity") or pos.get("net_quantity") or pos.get("qty") or "0"
                    avg = pos.get("avg_price") or pos.get("average_price") or "0"
                else:
                    qty = getattr(pos, "quantity", None) or getattr(pos, "net_quantity", None) or "0"
                    avg = getattr(pos, "avg_price", None) or getattr(pos, "average_price", None) or "0"
                try:
                    current_exposure += abs(Decimal(str(qty)) * Decimal(str(avg)))
                except Exception:
                    raise ValueError("Broker returned invalid position data; live risk validation cannot continue.")

        if self._safety_service:
            self._safety_service.validate_order(
                user_id=user_id,
                broker_id=broker_id,
                request=request,
                execution_mode="LIVE",
                current_positions=current_positions,
                current_exposure_notional=current_exposure,
            )
            return

        if self._risk_engine:
            self._risk_engine.validate_order(
                user_id=user_id,
                broker_id=broker_id,
                request=request,
                current_positions=current_positions,
                current_exposure_notional=current_exposure,
            )

    def _persist_order(
        self,
        *,
        user_id: UUID,
        broker_id: UUID,
        order: BrokerOrder,
        strategy_instance_id: Optional[UUID] = None,
        signal_id: Optional[UUID] = None,
        order_source: Optional[str] = "MANUAL_BUY",
    ) -> BrokerOrder:
        if self._order_repository:
            previous = self._order_repository.get_by_broker_order_id(broker_id, order.order_id)
            previous_filled = Decimal(str(previous.filled_quantity)) if previous else Decimal("0")
            previous_avg = previous.average_fill_price if previous else None
            record = self._order_repository.upsert_from_broker(
                user_id=user_id,
                broker_id=broker_id,
                broker_order=order,
                strategy_instance_id=strategy_instance_id,
                signal_id=signal_id,
                order_source=order_source,
            )
            execution = None
            if self._execution_position_service:
                execution = self._execution_position_service.reconcile_broker_order(
                    user_id=user_id,
                    broker_id=broker_id,
                    order_record=record,
                    previous_filled_quantity=previous_filled,
                    previous_average_fill_price=previous_avg,
                )
            if self._trading_event_publisher:
                status = str(order.status).upper()
                if status in {"REJECTED", "FAILED"}:
                    event_type = EventType.ORDER_REJECTED
                elif previous is None:
                    event_type = EventType.ORDER_CREATED
                else:
                    event_type = EventType.ORDER_UPDATED
                self._emit_order_event(event_type, user_id=user_id, broker_id=broker_id, order=order, strategy_instance_id=strategy_instance_id)
        return order

    def place_order(
        self,
        user_id: UUID,
        broker_id: UUID,
        request: BrokerOrderRequest,
        idempotency_key: Optional[str] = None,
        client: Optional[Any] = None,
        strategy_instance_id: Optional[UUID] = None,
        signal_id: Optional[UUID] = None,
        order_source: str = "MANUAL_BUY",
    ) -> BrokerOrder:
        """Place a new order through the resolved broker provider with idempotency and risk engine protection."""
        # 1. Enforcement of Semi-Automatic Execution Source Policy
        norm_source = str(order_source).upper().strip()
        if norm_source not in {"MANUAL_BUY", "MANUAL_SELL", "AUTO_STOP_LOSS"}:
            raise ExecutionPolicyViolationException(
                f"Execution policy violation: Direct strategy automated orders '{order_source}' are strictly rejected. "
                "Only MANUAL_BUY, MANUAL_SELL, and AUTO_STOP_LOSS are permitted."
            )

        if Decimal(str(request.quantity)) <= Decimal("0"):
            raise ValueError("Order quantity must be strictly greater than zero.")

        # 2. AUTO_STOP_LOSS Guard on Existing Open Position
        if norm_source == "AUTO_STOP_LOSS" and self._execution_position_service:
            live_pos = self._execution_position_service._positions.get_for_update(user_id, broker_id, request.symbol)
            if not live_pos or live_pos.status != "OPEN" or live_pos.quantity == Decimal("0"):
                raise ValueError("AUTO_STOP_LOSS order requires an existing valid open position.")

        if not self._idempotency_service or not idempotency_key:
            provider = self._get_provider(user_id=user_id, broker_id=broker_id, client=client)
            self._validate_risk(
                user_id=user_id,
                broker_id=broker_id,
                request=request,
                provider=provider,
            )
            order = provider.place_order(request)
            audit_event("LIVE_ORDER_SUBMITTED", user_id=user_id, broker_id=broker_id, outcome="SUCCESS",
                        order_id=order.order_id, symbol=order.symbol, side=order.side, quantity=str(order.quantity),
                        order_source=norm_source)
            return self._persist_order(
                user_id=user_id, broker_id=broker_id,
                order=order,
                strategy_instance_id=strategy_instance_id, signal_id=signal_id,
                order_source=norm_source,
            )

        request_dict = {
            "symbol": request.symbol,
            "exchange": request.exchange,
            "quantity": str(request.quantity),
            "side": request.side,
            "order_type": request.order_type,
            "product": request.product,
            "variety": request.variety,
            "price": str(request.price) if request.price is not None else None,
            "trigger_price": str(request.trigger_price) if request.trigger_price is not None else None,
        }

        def execute_fn() -> BrokerOrder:
            provider = self._get_provider(user_id=user_id, broker_id=broker_id, client=client)
            self._validate_risk(
                user_id=user_id,
                broker_id=broker_id,
                request=request,
                provider=provider,
            )
            order = provider.place_order(request)
            audit_event("LIVE_ORDER_SUBMITTED", user_id=user_id, broker_id=broker_id, outcome="SUCCESS",
                        order_id=order.order_id, symbol=order.symbol, side=order.side, quantity=str(order.quantity),
                        order_source=norm_source)
            return self._persist_order(
                user_id=user_id, broker_id=broker_id,
                order=order,
                strategy_instance_id=strategy_instance_id, signal_id=signal_id,
                order_source=norm_source,
            )

        def serialize_fn(order: BrokerOrder) -> Dict[str, Any]:
            return {
                "order_id": order.order_id,
                "symbol": order.symbol,
                "side": order.side,
                "quantity": str(order.quantity),
                "status": order.status,
            }

        def deserialize_fn(d: Dict[str, Any]) -> BrokerOrder:
            return BrokerOrder(
                order_id=d["order_id"],
                symbol=d["symbol"],
                side=d["side"],
                quantity=Decimal(d["quantity"]),
                status=d["status"],
            )

        return self._idempotency_service.execute_idempotent_order(
            user_id=user_id,
            broker_id=broker_id,
            idempotency_key=idempotency_key,
            request_payload=request_dict,
            execute_fn=execute_fn,
            deserialize_fn=deserialize_fn,
            serialize_fn=serialize_fn,
        )

    def modify_order(
        self,
        user_id: UUID,
        broker_id: UUID,
        order_id: str,
        request: BrokerOrderRequest,
        client: Optional[Any] = None
    ) -> BrokerOrderActionResult:
        """Modify an existing LIVE order through the resolved broker provider."""
        if self._safety_service:
            self._safety_service.validate_live_execution(user_id=user_id, broker_id=broker_id)
        provider = self._get_provider(user_id=user_id, broker_id=broker_id, client=client)
        result = provider.modify_order(order_id, request)
        if self._order_repository and result.success:
            record = self._order_repository.get_by_broker_order_id(broker_id, order_id)
            if record:
                record.price = request.price
                record.trigger_price = request.trigger_price
                record.quantity = request.quantity
                record.order_type = request.order_type
                record.product = request.product
                record.variety = request.variety
                self._order_repository.db.commit()
        return result

    def cancel_order(
        self,
        user_id: UUID,
        broker_id: UUID,
        request: BrokerCancelOrderRequest,
        client: Optional[Any] = None
    ) -> BrokerOrderActionResult:
        """Cancel an existing LIVE order through the resolved broker provider."""
        if self._safety_service:
            self._safety_service.validate_live_execution(user_id=user_id, broker_id=broker_id)
        provider = self._get_provider(user_id=user_id, broker_id=broker_id, client=client)
        result = provider.cancel_order(request)
        if self._order_repository and result.success:
            record = self._order_repository.get_by_broker_order_id(broker_id, request.order_id)
            if record:
                record.status = "CANCELLED"
                record.last_broker_sync_at = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
                self._order_repository.db.commit()
        if result.success and self._trading_event_publisher:
            record = self._order_repository.get_by_broker_order_id(broker_id, request.order_id) if self._order_repository else None
            self._trading_event_publisher.emit(
                EventType.ORDER_CANCELLED, user_id=user_id, broker_id=broker_id,
                symbol=record.symbol if record else None, execution_mode="LIVE",
                payload={"order_id": request.order_id, "status": "CANCELLED"}
            )
        return result

    def reconcile_orders(
        self,
        user_id: UUID,
        broker_id: UUID,
        client: Optional[Any] = None,
    ) -> List[BrokerOrder]:
        """Pull broker truth and upsert it into the application-owned order ledger."""
        provider = self._get_provider(user_id=user_id, broker_id=broker_id, client=client)
        broker_orders = provider.get_orders()
        audit_event("BROKER_RECONCILIATION", user_id=user_id, broker_id=broker_id, outcome="SUCCESS",
                    orders_seen=len(broker_orders))
        if self._order_repository:
            for order in broker_orders:
                previous = self._order_repository.get_by_broker_order_id(broker_id, order.order_id)
                previous_filled = Decimal(str(previous.filled_quantity)) if previous else Decimal("0")
                previous_avg = previous.average_fill_price if previous else None
                record = self._order_repository.upsert_from_broker(
                    user_id=user_id, broker_id=broker_id, broker_order=order
                )
                if self._execution_position_service:
                    self._execution_position_service.reconcile_broker_order(
                        user_id=user_id,
                        broker_id=broker_id,
                        order_record=record,
                        previous_filled_quantity=previous_filled,
                        previous_average_fill_price=previous_avg,
                    )
                if self._trading_event_publisher:
                    status = str(order.status).upper()
                    if status in {"REJECTED", "FAILED"}:
                        event_type = EventType.ORDER_REJECTED
                    elif previous is None:
                        event_type = EventType.ORDER_CREATED
                    else:
                        event_type = EventType.ORDER_UPDATED
                    self._emit_order_event(event_type, user_id=user_id, broker_id=broker_id, order=order, strategy_instance_id=record.strategy_instance_id)
        return broker_orders

    def get_orders(
        self,
        user_id: UUID,
        broker_id: UUID,
        client: Optional[Any] = None
    ) -> List[BrokerOrder]:
        """Reconcile broker state first, then return the broker-authoritative snapshot."""
        return self.reconcile_orders(user_id=user_id, broker_id=broker_id, client=client)

    def get_persisted_executions(self, user_id: UUID, broker_id: UUID, limit: int = 100) -> List[Any]:
        if not self._execution_position_service:
            return []
        return self._execution_position_service._executions.list_for_account(user_id=user_id, broker_id=broker_id, limit=limit)

    def get_positions(self, user_id: UUID, broker_id: UUID) -> List[Any]:
        if not self._execution_position_service:
            return []
        return self._execution_position_service._positions.list_for_account(user_id=user_id, broker_id=broker_id)

    def get_persisted_orders(
        self,
        user_id: UUID,
        broker_id: UUID,
        limit: int = 100,
    ) -> List[Any]:
        """Return the application-owned order ledger without calling the broker."""
        if not self._order_repository:
            return []
        return self._order_repository.list_for_account(user_id=user_id, broker_id=broker_id, limit=limit)
