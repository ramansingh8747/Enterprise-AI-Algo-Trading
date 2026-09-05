import unittest
from unittest.mock import MagicMock, patch
from uuid import uuid4
from decimal import Decimal

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

from app.brokers.base.broker_types import BrokerOrderRequest
from app.tests.mocks.mock_kite import MockKiteConnectClient

class TestZerodhaBrokerOrderLifecycle(unittest.TestCase):
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

        # Mock session
        mock_session = MagicMock()
        mock_session.access_token = "fake_token"
        self.mock_session_service.get_active_session.return_value = mock_session

    def test_full_order_lifecycle(self):
        # 1. Place order
        order_request = BrokerOrderRequest(
            symbol="INFY",
            exchange="NSE",
            quantity=Decimal("10"),
            side="buy",
            order_type="LIMIT",
            product="CNC",
            variety="regular",
            price=Decimal("1500.50")
        )
        place_result = self.broker.place_order(order_request)
        order_id = place_result.order_id
        self.assertIsNotNone(order_id)

        # 2. Modify order
        modify_request = BrokerOrderRequest(
            symbol="INFY",
            exchange="NSE",
            quantity=Decimal("10"),
            side="buy",
            order_type="LIMIT",
            product="CNC",
            variety="regular",
            price=Decimal("1600.00")
        )
        modify_result = self.broker.modify_order(order_id, modify_request)
        self.assertTrue(modify_result.success)

        # 3. Cancel order
        from app.brokers.base.broker_types import BrokerCancelOrderRequest
        cancel_request = BrokerCancelOrderRequest(order_id=order_id, variety="regular")
        cancel_result = self.broker.cancel_order(cancel_request)
        self.assertTrue(cancel_result.success)

if __name__ == '__main__':
    unittest.main()
