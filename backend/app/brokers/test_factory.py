import unittest
from unittest.mock import MagicMock, patch
from uuid import uuid4

# Mock Zerodha settings and logger before importing ZerodhaBroker
mock_settings_instance = MagicMock()
mock_settings_instance.ZERODHA_API_KEY = "test_key"
mock_settings_instance.ZERODHA_BASE_URL = None

mock_logger = MagicMock()

with patch("app.brokers.config.ZerodhaSettings", return_value=mock_settings_instance), \
     patch("app.core.logging.logger.logger", mock_logger):
    from app.brokers.factory import BrokerFactory
    from app.brokers.providers.zerodha.zerodha_broker import ZerodhaBroker
    from app.brokers.providers.upstox.upstox_broker import UpstoxBroker
    from app.brokers.providers.angelone.angelone_broker import AngelOneBroker
    from app.brokers.providers.dhan.dhan_broker import DhanBroker

from app.tests.mocks.mock_kite import MockKiteConnectClient


class TestBrokerFactory(unittest.TestCase):
    def setUp(self):
        self.mock_session_service = MagicMock()
        self.broker_id = uuid4()
        self.mock_client = MockKiteConnectClient(api_key="test_key")

    def test_get_provider_zerodha_success(self):
        """A: get_provider('zerodha', session_service, broker_id) returns ZerodhaBroker instance."""
        provider = BrokerFactory.get_provider(
            "zerodha",
            session_service=self.mock_session_service,
            broker_id=self.broker_id
        )
        self.assertIsInstance(provider, ZerodhaBroker)
        self.assertEqual(provider._broker_id, self.broker_id)

    def test_get_provider_zerodha_with_mock_client(self):
        """B: get_provider('zerodha', valid dependencies, mock_client) injects mock_client into ZerodhaBroker."""
        provider = BrokerFactory.get_provider(
            "zerodha",
            session_service=self.mock_session_service,
            broker_id=self.broker_id,
            client=self.mock_client
        )
        self.assertIsInstance(provider, ZerodhaBroker)
        self.assertIs(provider._client, self.mock_client)

    def test_get_provider_zerodha_missing_all_dependencies_raises_value_error(self):
        """C: get_provider('zerodha') raises clear ValueError due to missing required dependencies."""
        with self.assertRaises(ValueError) as ctx:
            BrokerFactory.get_provider("zerodha")
        self.assertIn("session_service and broker_id are required", str(ctx.exception))

    def test_get_provider_zerodha_missing_broker_id_raises_value_error(self):
        """D: get_provider('zerodha', session_service=<valid>, broker_id=None) raises clear ValueError."""
        with self.assertRaises(ValueError) as ctx:
            BrokerFactory.get_provider(
                "zerodha",
                session_service=self.mock_session_service,
                broker_id=None
            )
        self.assertIn("session_service and broker_id are required", str(ctx.exception))

    def test_get_provider_zerodha_missing_session_service_raises_value_error(self):
        """C/D variant: get_provider('zerodha', session_service=None, broker_id=<valid>) raises ValueError."""
        with self.assertRaises(ValueError) as ctx:
            BrokerFactory.get_provider(
                "zerodha",
                session_service=None,
                broker_id=self.broker_id
            )
        self.assertIn("session_service and broker_id are required", str(ctx.exception))

    def test_get_provider_upstox_success(self):
        """E: get_provider('upstox') returns UpstoxBroker."""
        provider = BrokerFactory.get_provider("upstox")
        self.assertIsInstance(provider, UpstoxBroker)

    def test_get_provider_angelone_success(self):
        """F: get_provider('angelone') returns AngelOneBroker."""
        provider = BrokerFactory.get_provider("angelone")
        self.assertIsInstance(provider, AngelOneBroker)

    def test_get_provider_dhan_success(self):
        """G: get_provider('dhan') returns DhanBroker."""
        provider = BrokerFactory.get_provider("dhan")
        self.assertIsInstance(provider, DhanBroker)

    def test_get_provider_unsupported_provider_raises_value_error(self):
        """H: Unsupported provider raises ValueError."""
        with self.assertRaises(ValueError) as ctx:
            BrokerFactory.get_provider("invalid_broker")
        self.assertIn("Unsupported broker provider: invalid_broker", str(ctx.exception))

    @patch("app.brokers.factory.ZerodhaBroker")
    def test_providers_not_eagerly_instantiated(self, mock_zerodha_cls):
        """I: Verify providers are not eagerly instantiated when another provider is requested."""
        provider = BrokerFactory.get_provider("upstox")
        self.assertIsInstance(provider, UpstoxBroker)
        mock_zerodha_cls.assert_not_called()


if __name__ == '__main__':
    unittest.main()
