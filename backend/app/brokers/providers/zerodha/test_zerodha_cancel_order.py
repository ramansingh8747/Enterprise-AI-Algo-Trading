import unittest
from unittest.mock import MagicMock, patch
import sys
from uuid import uuid4

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
from app.brokers.base.broker_types import BrokerCancelOrderRequest
from app.tests.mocks.mock_kite import MockKiteConnectClient

class TestZerodhaBrokerCancelOrder(unittest.TestCase):
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

    def test_cancel_order_success(self):
        req = BrokerCancelOrderRequest(
            order_id="MOCK-ORDER-000001",
            variety="regular"
        )
        result = self.broker.cancel_order(req)
        self.assertEqual(result.order_id, "MOCK-ORDER-000001")
        self.assertTrue(result.success)

    def test_cancel_order_with_parent(self):
        req = BrokerCancelOrderRequest(
            order_id="MOCK-ORDER-000001",
            variety="regular",
            parent_order_id="PARENT-001"
        )
        result = self.broker.cancel_order(req)
        self.assertEqual(result.order_id, "MOCK-ORDER-000001")
        self.assertTrue(result.success)

    def test_cancel_order_token_exception(self):
        req = BrokerCancelOrderRequest(order_id="123", variety="regular")
        self.mock_client.set_side_effect(TokenException("Token expired"))

        from app.exceptions.broker_exceptions import BrokerSessionExpiredException
        with self.assertRaises(BrokerSessionExpiredException):
            self.broker.cancel_order(req)

    def test_cancel_order_order_exception(self):
        req = BrokerCancelOrderRequest(order_id="123", variety="regular")
        self.mock_client.set_side_effect(OrderException("Order not found"))

        from app.exceptions.broker_exceptions import BrokerOrderException
        with self.assertRaises(BrokerOrderException):
            self.broker.cancel_order(req)

    def test_cancel_order_network_exception(self):
        req = BrokerCancelOrderRequest(order_id="123", variety="regular")
        self.mock_client.set_side_effect(NetworkException("Network error"))

        from app.exceptions.broker_exceptions import BrokerNetworkException
        with self.assertRaises(BrokerNetworkException):
            self.broker.cancel_order(req)

    def test_cancel_order_kite_exception(self):
        req = BrokerCancelOrderRequest(order_id="123", variety="regular")
        self.mock_client.set_side_effect(KiteException("Generic Kite error"))

        from app.exceptions.broker_exceptions import BrokerException
        with self.assertRaises(BrokerException):
            self.broker.cancel_order(req)

    def test_cancel_order_empty_order_id(self):
        req = BrokerCancelOrderRequest(order_id="", variety="regular")
        from app.exceptions.broker_exceptions import BrokerOrderException
        with self.assertRaises(BrokerOrderException):
            self.broker.cancel_order(req)
            self.mock_client.cancel_order.assert_not_called()

    def test_cancel_order_invalid_variety(self):
        req = BrokerCancelOrderRequest(order_id="123", variety="invalid")
        from app.exceptions.broker_exceptions import BrokerOrderException
        with self.assertRaises(BrokerOrderException):
            self.broker.cancel_order(req)
            self.mock_client.cancel_order.assert_not_called()

    def test_cancel_order_authentication_failure(self):
        # Clear user context
        self.broker.set_user_context(None)

        req = BrokerCancelOrderRequest(order_id="123", variety="regular")
        from app.exceptions.broker_exceptions import BrokerException
        with self.assertRaises(BrokerException):
            self.broker.cancel_order(req)
            self.mock_client.cancel_order.assert_not_called()
