from app.brokers.interfaces.broker_interface import BrokerInterface
from app.brokers.providers.zerodha.zerodha_broker import ZerodhaBroker
from app.brokers.providers.upstox.upstox_broker import UpstoxBroker
from app.brokers.providers.angelone.angelone_broker import AngelOneBroker
from app.brokers.providers.dhan.dhan_broker import DhanBroker

class BrokerFactory:
    """
    Factory for creating broker provider instances.
    """

    @staticmethod
    def get_provider(provider_name: str) -> BrokerInterface:
        """
        Returns a concrete broker implementation based on the provider name.

        Args:
            provider_name: The name of the broker (e.g., 'zerodha', 'upstox').

        Returns:
            An instance implementing BrokerInterface.

        Raises:
            ValueError: If the provider name is unknown.
        """
        providers = {
            "zerodha": ZerodhaBroker(),
            "upstox": UpstoxBroker(),
            "angelone": AngelOneBroker(),
            "dhan": DhanBroker(),
        }

        if provider_name not in providers:
            raise ValueError(f"Unsupported broker provider: {provider_name}")

        return providers[provider_name]
