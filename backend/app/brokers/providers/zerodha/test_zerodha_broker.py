import unittest
from unittest.mock import MagicMock, patch
import sys
from uuid import uuid4

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
from kiteconnect.exceptions import KiteException
from app.brokers.base.broker_types import BrokerOrderRequest, BrokerOrder, BrokerOrderActionResult, BrokerCancelOrderRequest, BrokerQuote

class TestZerodhaBroker(unittest.TestCase):
    def setUp(self):
        self.broker_id = uuid4()
        self.mock_session_service = MagicMock()
        # Instantiate ZerodhaBroker with required args
        self.broker = ZerodhaBroker(
            session_service=self.mock_session_service,
            broker_id=self.broker_id
        )
        self.broker._client = MagicMock()
        self.broker._logger = mock_logger.bind.return_value
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

        # Configure mock to return a sample order_id
        expected_order_id = "TEST-MOD-001"
        self.broker._client.modify_order.return_value = expected_order_id

        # Execute
        result = self.broker.modify_order("123", order_request)

        # Assert mapping to API
        self.broker._client.modify_order.assert_called_once_with(
            variety="regular",
            order_id="123",
            quantity=10,
            price=1500.50,
            order_type="LIMIT",
            trigger_price=1499.0
        )

        # Assert result mapping
        self.assertIsInstance(result, BrokerOrderActionResult)
        self.assertEqual(result.order_id, expected_order_id)
        self.assertTrue(result.success)

    def test_modify_order_kite_exception(self):
        # Prepare valid order request
        order_request = BrokerOrderRequest(
            symbol="INFY",
            exchange="NSE",
            quantity=Decimal("10"),
            side="buy",
            order_type="LIMIT",
            product="CNC",
            variety="regular"
        )

        # Configure mock to raise KiteException
        self.broker._client.modify_order.side_effect = KiteException("API Error")

        # Execute and assert exception chaining
        from app.exceptions.broker_exceptions import BrokerException
        with self.assertRaises(BrokerException):
            self.broker.modify_order("123", order_request)

    def test_cancel_order_success(self):
        # Prepare valid request
        cancel_request = BrokerCancelOrderRequest(
            order_id="123",
            variety="regular"
        )

        # Configure mock
        self.broker._client.cancel_order.return_value = "123"

        # Execute
        result = self.broker.cancel_order(cancel_request)

        # Assert SDK call
        self.broker._client.cancel_order.assert_called_once_with(
            variety="regular",
            order_id="123"
        )

        # Assert result
        self.assertIsInstance(result, BrokerOrderActionResult)
        self.assertEqual(result.order_id, "123")
        self.assertTrue(result.success)

    def test_cancel_order_with_parent(self):
        # Prepare valid request
        cancel_request = BrokerCancelOrderRequest(
            order_id="123",
            variety="regular",
            parent_order_id="PARENT-001"
        )

        # Configure mock
        self.broker._client.cancel_order.return_value = "123"

        # Execute
        self.broker.cancel_order(cancel_request)

        # Assert SDK call
        self.broker._client.cancel_order.assert_called_once_with(
            variety="regular",
            order_id="123",
            parent_order_id="PARENT-001"
        )

    def test_cancel_order_kite_exception(self):
        # Prepare request
        cancel_request = BrokerCancelOrderRequest(
            order_id="123",
            variety="regular"
        )

        # Configure mock
        self.broker._client.cancel_order.side_effect = KiteException("API Error")

        # Execute and assert
        from app.exceptions.broker_exceptions import BrokerException
        with self.assertRaises(BrokerException):
            self.broker.cancel_order(cancel_request)

    def test_get_quotes_success(self):
        symbols = ["NSE:INFY", "NSE:RELIANCE"]

        # Configure mock
        self.broker._client.quote.return_value = {
            "NSE:INFY": {
                "last_price": 1500.5,
                "depth": {
                    "buy": [{"price": 1500.0, "quantity": 10}],
                    "sell": [{"price": 1501.0, "quantity": 10}]
                }
            },
            "NSE:RELIANCE": {
                "last_price": 2500.5,
                "depth": {
                    "buy": [{"price": 2500.0, "quantity": 10}],
                    "sell": [{"price": 2501.0, "quantity": 10}]
                }
            }
        }

        # Execute
        quotes = self.broker.get_quotes(symbols)

        # Verify SDK called correctly
        self.broker._client.quote.assert_called_once_with("NSE:INFY", "NSE:RELIANCE")

        # Verify result
        self.assertEqual(len(quotes), 2)
        self.assertEqual(quotes[0].symbol, "NSE:INFY")
        self.assertEqual(quotes[0].bid, Decimal("1500.0"))
        self.assertEqual(quotes[0].ask, Decimal("1501.0"))
        self.assertEqual(quotes[0].last_price, Decimal("1500.5"))

    def test_get_quotes_empty(self):
        self.assertEqual(self.broker.get_quotes([]), [])
        self.broker._client.quote.assert_not_called()

    def test_get_quotes_missing_depth(self):
        symbols = ["NSE:INFY"]
        self.broker._client.quote.return_value = {
            "NSE:INFY": {
                "last_price": 1500.5,
                "depth": {"buy": [], "sell": [{"price": 1501.0}]}
            }
        }

        from app.exceptions.broker_exceptions import BrokerException
        with self.assertRaises(BrokerException):
            self.broker.get_quotes(symbols)

    def test_get_quotes_kite_exception(self):
        self.broker._client.quote.side_effect = KiteException("API Error")
        from app.exceptions.broker_exceptions import BrokerException
        with self.assertRaises(BrokerException):
            self.broker.get_quotes(["NSE:INFY"])

if __name__ == '__main__':
    unittest.main()
