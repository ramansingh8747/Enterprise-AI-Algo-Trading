import unittest
from unittest.mock import MagicMock, patch
import sys
from uuid import uuid4
from decimal import Decimal

# Imports

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

from kiteconnect.exceptions import TokenException, OrderException, NetworkException, KiteException
from app.brokers.base.broker_types import BrokerOrderRequest, BrokerOrderActionResult
from app.tests.mocks.mock_kite import MockKiteConnectClient

class TestZerodhaBrokerModifyOrderEndToEnd(unittest.TestCase):
    def setUp(self):
        self.broker_id = uuid4()
        self.mock_session_service = MagicMock()
        self.mock_client = MockKiteConnectClient(api_key="test_key")
        self.broker = ZerodhaBroker(
            session_service=self.mock_session_service,
            broker_id=self.broker_id,
            client=self.mock_client
        )
        self.broker.set_user_context(uuid4())

        # Mock session
        mock_session = MagicMock()
        mock_session.access_token = "fake_token"
        self.mock_session_service.get_active_session.return_value = mock_session

    def test_modify_order_success(self):
        # Prepare valid order request
        order_request = BrokerOrderRequest(
            symbol="INFY",
            exchange="NSE",
            quantity=Decimal("10"),
            side="buy",
            order_type="LIMIT",
            product="CNC",
            variety="regular",
            price=Decimal("1500.50"),
            trigger_price=Decimal("1499.00")
        )

        # Execute
        result = self.broker.modify_order("MOCK-ORDER-000001", order_request)

        # Assert result mapping
        self.assertIsInstance(result, BrokerOrderActionResult)
        self.assertEqual(result.order_id, "MOCK-ORDER-000001")
        self.assertTrue(result.success)

    def test_modify_order_token_exception(self):
        order_request = BrokerOrderRequest(
            symbol="INFY", exchange="NSE", quantity=Decimal("10"),
            side="buy", order_type="LIMIT", product="CNC", variety="regular",
            price=Decimal("1500.50")
        )
        self.mock_client.set_side_effect(TokenException("Token expired"))

        from app.exceptions.broker_exceptions import BrokerSessionExpiredException
        with self.assertRaises(BrokerSessionExpiredException):
            self.broker.modify_order("123", order_request)

    def test_modify_order_authentication_failure(self):
        # Clear user context
        self.broker.set_user_context(None)

        order_request = BrokerOrderRequest(
            symbol="INFY", exchange="NSE", quantity=Decimal("10"),
            side="buy", order_type="LIMIT", product="CNC", variety="regular"
        )
        from app.exceptions.broker_exceptions import BrokerException
        with self.assertRaises(BrokerException):
            self.broker.modify_order("123", order_request)

if __name__ == '__main__':
    unittest.main()
