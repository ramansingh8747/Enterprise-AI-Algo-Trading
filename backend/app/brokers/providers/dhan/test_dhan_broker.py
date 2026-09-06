"""
Unit tests for DhanBroker provider.
"""

import unittest
from decimal import Decimal
from typing import Any
from unittest.mock import MagicMock
from uuid import uuid4

import httpx

from app.brokers.base.broker_types import (
    BrokerCancelOrderRequest,
    BrokerOrderRequest,
)
from app.brokers.providers.dhan.dhan_broker import DhanBroker
from app.exceptions.broker_exceptions import (
    BrokerException,
    BrokerNetworkException,
    BrokerSessionExpiredException,
)


class MockResponse:
    """Mock HTTP response object."""

    def __init__(self, status_code: int = 200, json_data: Any = None, text: str = ""):
        self.status_code = status_code
        self._json_data = json_data if json_data is not None else {}
        self.text = text

    def json(self):
        return self._json_data


class TestDhanBroker(unittest.TestCase):
    def setUp(self):
        self.broker_id = uuid4()
        self.user_id = uuid4()
        self.mock_session_service = MagicMock()
        self.mock_http_client = MagicMock()

        self.broker = DhanBroker(
            session_service=self.mock_session_service,
            broker_id=self.broker_id,
            client_id="DHAN12345",
            access_token="valid_test_token",
            client=self.mock_http_client,
        )
        self.broker.set_user_context(self.user_id)

    def test_get_profile_success(self):
        """Verify DhanBroker.get_profile returns parsed BrokerProfile."""
        self.mock_http_client.get.return_value = MockResponse(
            status_code=200,
            json_data={"dhanClientId": "DHAN12345", "availabelBalance": 50000.0},
        )

        profile = self.broker.get_profile()
        self.assertEqual(profile.account_id, "DHAN12345")
        self.assertEqual(profile.account_type, "TRADING")
        self.assertEqual(profile.currency, "INR")

    def test_get_holdings_success(self):
        """Verify DhanBroker.get_holdings parses holdings with Decimal precision."""
        self.mock_http_client.get.return_value = MockResponse(
            status_code=200,
            json_data=[
                {
                    "tradingSymbol": "RELIANCE",
                    "totalQty": 25,
                    "avgCostPrice": 2450.75,
                },
                {
                    "tradingSymbol": "TCS",
                    "holdingQty": 10,
                    "avgCostPrice": 3500.00,
                },
            ],
        )

        holdings = self.broker.get_holdings()
        self.assertEqual(len(holdings), 2)
        self.assertEqual(holdings[0].symbol, "RELIANCE")
        self.assertEqual(holdings[0].quantity, Decimal("25"))
        self.assertEqual(holdings[0].average_price, Decimal("2450.75"))
        self.assertEqual(holdings[1].symbol, "TCS")
        self.assertEqual(holdings[1].quantity, Decimal("10"))

    def test_get_positions_success(self):
        """Verify DhanBroker.get_positions converts positions with correct side and avg_price."""
        self.mock_http_client.get.return_value = MockResponse(
            status_code=200,
            json_data=[
                {
                    "tradingSymbol": "INFY",
                    "netQty": 50,
                    "positionType": "LONG",
                    "costPrice": 1420.50,
                },
                {
                    "tradingSymbol": "WIPRO",
                    "netQty": -20,
                    "positionType": "SHORT",
                    "costPrice": 480.00,
                },
                {
                    "tradingSymbol": "FLAT",
                    "netQty": 0,
                    "costPrice": 100.00,
                },
            ],
        )

        positions = self.broker.get_positions()
        # Zero quantity position should be filtered out
        self.assertEqual(len(positions), 2)
        self.assertEqual(positions[0].symbol, "INFY")
        self.assertEqual(positions[0].quantity, Decimal("50"))
        self.assertEqual(positions[0].side, "buy")
        self.assertEqual(positions[1].symbol, "WIPRO")
        self.assertEqual(positions[1].quantity, Decimal("20"))
        self.assertEqual(positions[1].side, "sell")

    def test_get_orders_success(self):
        """Verify DhanBroker.get_orders parses orders into BrokerOrder instances."""
        self.mock_http_client.get.return_value = MockResponse(
            status_code=200,
            json_data=[
                {
                    "orderId": "ORD-DHAN-001",
                    "tradingSymbol": "HDFCBANK",
                    "transactionType": "BUY",
                    "orderStatus": "TRADED",
                    "quantity": 100,
                    "filledQty": 100,
                    "averagePrice": 1650.00,
                    "orderType": "LIMIT",
                    "productType": "CNC",
                }
            ],
        )

        orders = self.broker.get_orders()
        self.assertEqual(len(orders), 1)
        self.assertEqual(orders[0].order_id, "ORD-DHAN-001")
        self.assertEqual(orders[0].symbol, "HDFCBANK")
        self.assertEqual(orders[0].side, "buy")
        self.assertEqual(orders[0].status, "traded")
        self.assertEqual(orders[0].quantity, Decimal("100"))
        self.assertEqual(orders[0].average_fill_price, Decimal("1650.00"))

    def test_place_order_paper_mode_safe(self):
        """Verify order placement executes paper simulated order when LIVE_TRADING_ENABLED is False."""
        order_req = BrokerOrderRequest(
            symbol="TATAMOTORS",
            exchange="NSE",
            quantity=Decimal("50"),
            side="BUY",
            order_type="MARKET",
            product="CNC",
            variety="regular",
            price=Decimal("950.00"),
        )

        result = self.broker.place_order(order_req)
        self.assertTrue(result.order_id.startswith("DHAN-PAPER-"))
        self.assertEqual(result.symbol, "TATAMOTORS")
        self.assertEqual(result.side, "buy")
        self.assertEqual(result.quantity, Decimal("50"))
        self.assertEqual(result.status, "confirmed")
        # Ensure no HTTP POST call was made to real broker
        self.mock_http_client.post.assert_not_called()

    def test_modify_and_cancel_order_paper_mode(self):
        """Verify modify and cancel succeed without broker API call in paper mode."""
        mod_result = self.broker.modify_order("DHAN-PAPER-123", MagicMock())
        self.assertTrue(mod_result.success)
        self.assertEqual(mod_result.order_id, "DHAN-PAPER-123")

        cancel_req = BrokerCancelOrderRequest(order_id="DHAN-PAPER-123", variety="regular")
        cancel_result = self.broker.cancel_order(cancel_req)
        self.assertTrue(cancel_result.success)
        self.assertEqual(cancel_result.order_id, "DHAN-PAPER-123")

    def test_get_quotes_success(self):
        """Verify get_quotes returns formatted quotes for requested symbols."""
        quotes = self.broker.get_quotes(["INFY", "TCS"])
        self.assertEqual(len(quotes), 2)
        self.assertEqual(quotes[0].symbol, "INFY")
        self.assertEqual(quotes[1].symbol, "TCS")
        self.assertGreater(quotes[0].last_price, Decimal("0"))

        empty_quotes = self.broker.get_quotes([])
        self.assertEqual(len(empty_quotes), 0)

    def test_auth_expired_translation(self):
        """Verify 401 HTTP response translates to BrokerSessionExpiredException."""
        self.mock_http_client.get.return_value = MockResponse(
            status_code=401, text="Unauthorized: Token Expired"
        )
        with self.assertRaises(BrokerSessionExpiredException):
            self.broker.get_holdings()

    def test_network_timeout_translation(self):
        """Verify httpx.TimeoutException translates to BrokerNetworkException."""
        self.mock_http_client.get.side_effect = httpx.TimeoutException("Connection timed out")
        with self.assertRaises(BrokerNetworkException):
            self.broker.get_positions()


if __name__ == "__main__":
    unittest.main()
