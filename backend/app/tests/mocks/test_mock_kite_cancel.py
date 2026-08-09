import unittest
from app.tests.mocks.mock_kite import MockKiteConnectClient
from kiteconnect.exceptions import TokenException, OrderException, NetworkException, KiteException

class TestMockKiteConnectClientCancelOrder(unittest.TestCase):
    def setUp(self):
        self.mock_client = MockKiteConnectClient(api_key="dummy_key")

    def test_cancel_order_success(self):
        order_id = "MOCK-ORDER-000001"
        result = self.mock_client.cancel_order(variety="regular", order_id=order_id)
        self.assertEqual(result, order_id)

    def test_cancel_order_with_parent(self):
        order_id = "MOCK-ORDER-000001"
        result = self.mock_client.cancel_order(
            variety="regular", order_id=order_id, parent_order_id="PARENT-001"
        )
        self.assertEqual(result, order_id)

    def test_cancel_order_missing_params(self):
        with self.assertRaises(ValueError):
            self.mock_client.cancel_order(variety="regular", order_id="")

    def test_cancel_order_exception_simulation(self):
        self.mock_client.set_side_effect(OrderException("Order not found"))
        with self.assertRaises(OrderException):
            self.mock_client.cancel_order(variety="regular", order_id="123")

if __name__ == '__main__':
    unittest.main()
