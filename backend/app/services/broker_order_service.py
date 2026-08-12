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
    ) -> None:
        self._session_service = session_service
        self._broker_service = broker_service
        self._broker_factory = broker_factory
        self._idempotency_service = idempotency_service
        self._risk_engine = risk_engine

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

    def place_order(
        self,
        user_id: UUID,
        broker_id: UUID,
        request: BrokerOrderRequest,
        idempotency_key: Optional[str] = None,
        client: Optional[Any] = None
    ) -> BrokerOrder:
        """Place a new order through the resolved broker provider with idempotency and risk engine protection."""
        if not self._idempotency_service or not idempotency_key:
            if self._risk_engine:
                self._risk_engine.validate_order(user_id=user_id, broker_id=broker_id, request=request)
            provider = self._get_provider(user_id=user_id, broker_id=broker_id, client=client)
            return provider.place_order(request)

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
            if self._risk_engine:
                self._risk_engine.validate_order(user_id=user_id, broker_id=broker_id, request=request)
            provider = self._get_provider(user_id=user_id, broker_id=broker_id, client=client)
            return provider.place_order(request)

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
        """Modify an existing order through the resolved broker provider."""
        provider = self._get_provider(user_id=user_id, broker_id=broker_id, client=client)
        return provider.modify_order(order_id, request)

    def cancel_order(
        self,
        user_id: UUID,
        broker_id: UUID,
        request: BrokerCancelOrderRequest,
        client: Optional[Any] = None
    ) -> BrokerOrderActionResult:
        """Cancel an existing order through the resolved broker provider."""
        provider = self._get_provider(user_id=user_id, broker_id=broker_id, client=client)
        return provider.cancel_order(request)

    def get_orders(
        self,
        user_id: UUID,
        broker_id: UUID,
        client: Optional[Any] = None
    ) -> List[BrokerOrder]:
        """Retrieve recent orders from the resolved broker provider."""
        provider = self._get_provider(user_id=user_id, broker_id=broker_id, client=client)
        return provider.get_orders()
