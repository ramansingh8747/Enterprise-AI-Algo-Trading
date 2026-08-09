import unittest
from decimal import Decimal
from kiteconnect import KiteConnect
from app.brokers.base.broker_types import BrokerOrderRequest, BrokerCancelOrderRequest
from app.brokers.providers.zerodha.zerodha_order_mapper import ZerodhaOrderMapper
from app.tests.mocks.mock_kite import MockKiteConnectClient

class TestZerodhaOrderMapper(unittest.TestCase):

    def test_map_market_order(self):
        req = BrokerOrderRequest(
            symbol="INFY", exchange="NSE", quantity=Decimal("10"),
            side="BUY", order_type="MARKET", product="MIS", variety="REGULAR"
        )
        params = ZerodhaOrderMapper.map_to_sdk_params(req)
        self.assertEqual(params["order_type"], KiteConnect.ORDER_TYPE_MARKET)
        self.assertEqual(params["quantity"], 10)
        self.assertNotIn("price", params)

    def test_map_limit_order(self):
        req = BrokerOrderRequest(
            symbol="INFY", exchange="NSE", quantity=Decimal("10"),
            side="BUY", order_type="LIMIT", product="CNC", variety="REGULAR",
            price=Decimal("1500.50")
        )
        params = ZerodhaOrderMapper.map_to_sdk_params(req)
        self.assertEqual(params["price"], 1500.5)

    def test_invalid_market_with_price(self):
        req = BrokerOrderRequest(
            symbol="INFY", exchange="NSE", quantity=Decimal("10"),
            side="BUY", order_type="MARKET", product="MIS", variety="REGULAR",
            price=Decimal("1500.00")
        )
        with self.assertRaises(ValueError):
            ZerodhaOrderMapper.map_to_sdk_params(req)

    def test_invalid_quantity(self):
        req = BrokerOrderRequest(
            symbol="INFY", exchange="NSE", quantity=Decimal("0"),
            side="BUY", order_type="MARKET", product="MIS", variety="REGULAR"
        )
        with self.assertRaises(ValueError):
            ZerodhaOrderMapper.map_to_sdk_params(req)

    def test_invalid_variety(self):
        req = BrokerOrderRequest(
            symbol="INFY", exchange="NSE", quantity=Decimal("10"),
            side="BUY", order_type="MARKET", product="MIS", variety="INVALID"
        )
        with self.assertRaises(ValueError):
            ZerodhaOrderMapper.map_to_sdk_params(req)

    def test_mock_integration(self):
        # Verify mapper output fits MockKiteConnectClient
        req = BrokerOrderRequest(
            symbol="INFY", exchange="NSE", quantity=Decimal("5"),
            side="SELL", order_type="LIMIT", product="CNC", variety="REGULAR",
            price=Decimal("100.00")
        )
        params = ZerodhaOrderMapper.map_to_sdk_params(req)

        mock_client = MockKiteConnectClient(api_key="test")
        order_id = mock_client.place_order(**params)

        self.assertEqual(order_id, "MOCK-ORDER-000001")

    def test_map_cancel_order_valid(self):
        req = BrokerCancelOrderRequest(order_id="123", variety="regular")
        params = ZerodhaOrderMapper.map_cancel_to_sdk_params(req)
        self.assertEqual(params["order_id"], "123")
        self.assertEqual(params["variety"], KiteConnect.VARIETY_REGULAR)
        self.assertNotIn("parent_order_id", params)

    def test_map_cancel_order_with_parent(self):
        req = BrokerCancelOrderRequest(order_id="123", variety="regular", parent_order_id="456")
        params = ZerodhaOrderMapper.map_cancel_to_sdk_params(req)
        self.assertEqual(params["parent_order_id"], "456")

    def test_map_cancel_order_invalid_variety(self):
        req = BrokerCancelOrderRequest(order_id="123", variety="invalid")
        with self.assertRaises(ValueError):
            ZerodhaOrderMapper.map_cancel_to_sdk_params(req)

    def test_map_modify_order_valid(self):
        req = BrokerOrderRequest(
            symbol="INFY", exchange="NSE", quantity=Decimal("10"),
            side="BUY", order_type="LIMIT", product="CNC", variety="REGULAR",
            price=Decimal("1500.50")
        )
        params = ZerodhaOrderMapper.map_modify_to_sdk_params("123", req)
        self.assertEqual(params["order_id"], "123")
        self.assertEqual(params["variety"], KiteConnect.VARIETY_REGULAR)
        self.assertEqual(params["quantity"], 10)
        self.assertEqual(params["price"], 1500.5)
        self.assertEqual(params["order_type"], KiteConnect.ORDER_TYPE_LIMIT)

    def test_map_modify_order_invalid_id(self):
        req = BrokerOrderRequest(
            symbol="INFY", exchange="NSE", quantity=Decimal("10"),
            side="BUY", order_type="LIMIT", product="CNC", variety="REGULAR"
        )
        with self.assertRaises(ValueError):
            ZerodhaOrderMapper.map_modify_to_sdk_params("", req)

    def test_map_modify_order_invalid_variety(self):
        req = BrokerOrderRequest(
            symbol="INFY", exchange="NSE", quantity=Decimal("10"),
            side="BUY", order_type="LIMIT", product="CNC", variety="INVALID"
        )
        with self.assertRaises(ValueError):
            ZerodhaOrderMapper.map_modify_to_sdk_params("123", req)

    def test_map_modify_order_invalid_quantity(self):
        req = BrokerOrderRequest(
            symbol="INFY",
            exchange="NSE",
            quantity=Decimal("0"),
            side="BUY",
            order_type="LIMIT",
            product="CNC",
            variety="REGULAR",
            price=Decimal("1500.50")
        )

        with self.assertRaises(ValueError):
            ZerodhaOrderMapper.map_modify_to_sdk_params("123", req)

    def test_map_modify_order_negative_quantity(self):
        req = BrokerOrderRequest(
            symbol="INFY",
            exchange="NSE",
            quantity=Decimal("-10"),
            side="BUY",
            order_type="LIMIT",
            product="CNC",
            variety="REGULAR",
            price=Decimal("1500.50")
        )

        with self.assertRaises(ValueError):
            ZerodhaOrderMapper.map_modify_to_sdk_params("123", req)

    def test_map_modify_order_limit_without_price(self):
        req = BrokerOrderRequest(
            symbol="INFY",
            exchange="NSE",
            quantity=Decimal("10"),
            side="BUY",
            order_type="LIMIT",
            product="CNC",
            variety="REGULAR",
            price=None
        )

        with self.assertRaises(ValueError):
            ZerodhaOrderMapper.map_modify_to_sdk_params("123", req)

if __name__ == '__main__':
    unittest.main()
