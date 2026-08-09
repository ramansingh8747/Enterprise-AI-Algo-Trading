import unittest
from app.tests.mocks.mock_kite import MockKiteConnectClient
from kiteconnect.exceptions import TokenException, OrderException, NetworkException, KiteException

class TestMockKiteConnectClient(unittest.TestCase):
    def setUp(self):
        self.mock_client = MockKiteConnectClient(api_key="dummy_key")

    def test_place_order_success(self):
        order_id = self.mock_client.place_order(
            variety="regular", exchange="NSE", tradingsymbol="INFY",
            transaction_type="BUY", quantity=10, product="CNC", order_type="LIMIT"
        )
        self.assertEqual(order_id, "MOCK-ORDER-000001")

    def test_place_order_invalid_quantity(self):
        with self.assertRaises(ValueError):
            self.mock_client.place_order(
                variety="regular", exchange="NSE", tradingsymbol="INFY",
                transaction_type="BUY", quantity=0, product="CNC", order_type="LIMIT"
            )

    def test_place_order_missing_params(self):
        with self.assertRaises(ValueError):
            self.mock_client.place_order(
                variety="regular", exchange="NSE", tradingsymbol="INFY",
                transaction_type="BUY", quantity=10, product="CNC", order_type="" # Empty order_type
            )

    def test_simulate_token_exception(self):
        self.mock_client.set_side_effect(TokenException("Token expired"))
        with self.assertRaises(TokenException):
            self.mock_client.place_order("regular", "NSE", "INFY", "BUY", 10, "CNC", "LIMIT")

    def test_simulate_order_exception(self):
        self.mock_client.set_side_effect(OrderException("Invalid order"))
        with self.assertRaises(OrderException):
            self.mock_client.place_order("regular", "NSE", "INFY", "BUY", 10, "CNC", "LIMIT")

    def test_simulate_network_exception(self):
        self.mock_client.set_side_effect(NetworkException("Network error"))
        with self.assertRaises(NetworkException):
            self.mock_client.place_order("regular", "NSE", "INFY", "BUY", 10, "CNC", "LIMIT")

    def test_simulate_kite_exception(self):
        self.mock_client.set_side_effect(KiteException("Generic Kite error"))
        with self.assertRaises(KiteException):
            self.mock_client.place_order("regular", "NSE", "INFY", "BUY", 10, "CNC", "LIMIT")
