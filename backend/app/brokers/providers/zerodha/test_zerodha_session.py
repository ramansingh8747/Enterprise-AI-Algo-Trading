import unittest
from unittest.mock import MagicMock, patch
from uuid import uuid4
from app.exceptions.broker_exceptions import BrokerSessionExpiredException, BrokerException

# Mock settings
mock_settings_instance = MagicMock()
mock_settings_instance.ZERODHA_API_KEY = "test_key"
mock_settings_instance.ZERODHA_BASE_URL = None

# Mock logger
mock_logger = MagicMock()

# Patch relevant objects before importing ZerodhaBroker
with patch("app.brokers.config.ZerodhaSettings", return_value=mock_settings_instance), \
     patch("app.core.logging.logger.logger", mock_logger):
    from app.brokers.providers.zerodha.zerodha_broker import ZerodhaBroker

from app.tests.mocks.mock_kite import MockKiteConnectClient

class TestZerodhaBrokerSession(unittest.TestCase):
    def setUp(self):
        self.broker_id = uuid4()
        self.mock_session_service = MagicMock()
        self.mock_client = MockKiteConnectClient(api_key="test_key")
        self.broker = ZerodhaBroker(
            session_service=self.mock_session_service,
            broker_id=self.broker_id,
            client=self.mock_client
        )
        self.user_id = uuid4()
        self.broker.set_user_context(self.user_id)

    def test_disconnect_success(self):
        # Mock active session
        mock_session = MagicMock()
        mock_session.id = uuid4()
        self.mock_session_service.get_active_session.return_value = mock_session

        self.broker.disconnect()

        self.mock_session_service.revoke_session.assert_called_once_with(mock_session.id)
        self.assertIsNone(self.mock_client.access_token)

    def test_disconnect_no_active_session(self):
        self.mock_session_service.get_active_session.return_value = None
        self.broker.disconnect()
        self.mock_session_service.revoke_session.assert_not_called()

    def test_refresh_session_raises_exception(self):
        with self.assertRaises(BrokerException):
            self.broker.refresh_session()

if __name__ == '__main__':
    unittest.main()
