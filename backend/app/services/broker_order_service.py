from typing import List, Optional, Any
from uuid import UUID

from app.brokers.factory import BrokerFactory
from app.brokers.interfaces.broker_interface import BrokerInterface
from app.brokers.base.broker_types import (
    BrokerOrder, BrokerOrderRequest, BrokerOrderActionResult, BrokerCancelOrderRequest
)
from app.services.interfaces.broker_session_service import BrokerSessionServiceInterface
from app.services.broker_service import BrokerService


class BrokerOrderService:
    """
    Orchestration service for broker order operations.
    Integrates session lookup, provider factory instantiation, user context setting,
    and delegation to concrete BrokerInterface implementations.
    """

    def __init__(
        self,
        session_service: BrokerSessionServiceInterface,
        broker_service: BrokerService,
        broker_factory: type[BrokerFactory] = BrokerFactory
    ) -> None:
        self._session_service = session_service
        self._broker_service = broker_service
        self._broker_factory = broker_factory

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
        client: Optional[Any] = None
    ) -> BrokerOrder:
        """Place a new order through the resolved broker provider."""
        provider = self._get_provider(user_id=user_id, broker_id=broker_id, client=client)
        return provider.place_order(request)

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
