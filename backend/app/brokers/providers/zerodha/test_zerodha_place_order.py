import unittest
from unittest.mock import MagicMock, patch
import sys

# Imports

# Mock settings
mock_settings_instance = MagicMock()
mock_settings_instance.ZERODHA_API_KEY = "test_key"
mock_settings_instance.ZERODHA_BASE_URL = None
mock_settings_instance.ZERODHA_API_SECRET = "test_secret"

# Mock logger
mock_logger = MagicMock()

# Patch relevant objects before importing ZerodhaBroker
with patch("app.brokers.config.ZerodhaSettings", return_value=mock_settings_instance), \
     patch("app.core.logging.logger.logger", mock_logger):
    from app.brokers.providers.zerodha.zerodha_broker import ZerodhaBroker

from decimal import Decimal
from uuid import uuid4
from kiteconnect.exceptions import TokenException, OrderException, NetworkException, KiteException
from app.brokers.base.broker_types import BrokerOrderRequest
from app.tests.mocks.mock_kite import MockKiteConnectClient

class TestZerodhaBrokerPlaceOrder(unittest.TestCase):
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

    def test_place_order_success(self):
        req = BrokerOrderRequest(
            symbol="INFY", exchange="NSE", quantity=Decimal("10"),
            side="BUY", order_type="LIMIT", product="CNC", variety="REGULAR",
            price=Decimal("1500.50")
        )
        order = self.broker.place_order(req)
        self.assertEqual(order.order_id, "MOCK-ORDER-000001")
        self.assertEqual(order.symbol, "INFY")

    def test_place_order_token_exception(self):
        req = BrokerOrderRequest(
            symbol="INFY", exchange="NSE", quantity=Decimal("10"),
            side="BUY", order_type="LIMIT", product="CNC", variety="REGULAR",
            price=Decimal("1500.50")
        )
        self.mock_client.set_side_effect(TokenException("Token expired"))

        from app.exceptions.broker_exceptions import BrokerSessionExpiredException
        with self.assertRaises(BrokerSessionExpiredException):
            self.broker.place_order(req)

    def test_place_order_order_exception(self):
        req = BrokerOrderRequest(
            symbol="INFY", exchange="NSE", quantity=Decimal("10"),
            side="BUY", order_type="LIMIT", product="CNC", variety="REGULAR",
            price=Decimal("1500.50")
        )
        self.mock_client.set_side_effect(OrderException("Order error"))

        from app.exceptions.broker_exceptions import BrokerOrderException
        with self.assertRaises(BrokerOrderException):
            self.broker.place_order(req)

    def test_place_order_network_exception(self):
        req = BrokerOrderRequest(
            symbol="INFY", exchange="NSE", quantity=Decimal("10"),
            side="BUY", order_type="LIMIT", product="CNC", variety="REGULAR",
            price=Decimal("1500.50")
        )
        self.mock_client.set_side_effect(NetworkException("Network error"))

        from app.exceptions.broker_exceptions import BrokerNetworkException
        with self.assertRaises(BrokerNetworkException):
            self.broker.place_order(req)

    def test_place_order_kite_exception(self):
        req = BrokerOrderRequest(
            symbol="INFY", exchange="NSE", quantity=Decimal("10"),
            side="BUY", order_type="LIMIT", product="CNC", variety="REGULAR",
            price=Decimal("1500.50")
        )
        self.mock_client.set_side_effect(KiteException("Generic Kite error"))

        from app.exceptions.broker_exceptions import BrokerException
        with self.assertRaises(BrokerException):
            self.broker.place_order(req)
