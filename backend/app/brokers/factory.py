from typing import Optional, Any
from uuid import UUID

from app.brokers.interfaces.broker_interface import BrokerInterface
from app.brokers.providers.zerodha.zerodha_broker import ZerodhaBroker
from app.brokers.providers.upstox.upstox_broker import UpstoxBroker
from app.brokers.providers.angelone.angelone_broker import AngelOneBroker
from app.brokers.providers.dhan.dhan_broker import DhanBroker
from app.services.interfaces.broker_session_service import BrokerSessionServiceInterface


class BrokerFactory:
    """
    Factory for creating broker provider instances.
    """

    @staticmethod
    def get_provider(
        provider_name: str,
        session_service: Optional[BrokerSessionServiceInterface] = None,
        broker_id: Optional[UUID] = None,
        client: Optional[Any] = None
    ) -> BrokerInterface:
        """
        Returns a concrete broker implementation based on the provider name.

        Args:
            provider_name: The name of the broker (e.g., 'zerodha', 'upstox').
            session_service: Service to manage broker session authentication tokens.
            broker_id: Database UUID of the target broker account.
            client: Optional SDK client (e.g., mock client for testing).

        Returns:
            An instance implementing BrokerInterface.

        Raises:
            ValueError: If the provider name is unknown or required dependencies are missing.
        """
        normalized_name = provider_name.lower()

        if normalized_name == "zerodha":
            if session_service is None or broker_id is None:
                raise ValueError("session_service and broker_id are required for Zerodha provider.")
            return ZerodhaBroker(
                session_service=session_service,
                broker_id=broker_id,
                client=client
            )
        elif normalized_name == "upstox":
            return UpstoxBroker()
        elif normalized_name == "angelone":
            return AngelOneBroker()
        elif normalized_name == "dhan":
            return DhanBroker()
        else:
            raise ValueError(f"Unsupported broker provider: {provider_name}")

