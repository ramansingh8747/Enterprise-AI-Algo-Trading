import unittest
from unittest.mock import MagicMock, patch
from uuid import uuid4
from decimal import Decimal
from fastapi.testclient import TestClient

from app.main import app
from app.api.v1.routes.auth import get_current_active_user
from app.dependencies.broker import get_broker_order_service
from app.brokers.base.broker_types import (
    BrokerOrder, BrokerOrderActionResult
)
from app.exceptions.auth_exceptions import BrokerNotFoundException
from app.exceptions.broker_exceptions import (
    BrokerOrderException, BrokerSessionExpiredException, BrokerNetworkException
)

client = TestClient(app)


class TestBrokerOrdersAPI(unittest.TestCase):
    def setUp(self):
        self.user_id = uuid4()
        self.broker_id = uuid4()

        # Mock user
        self.mock_user = MagicMock()
        self.mock_user.id = self.user_id

        # Mock BrokerOrderService
        self.mock_service = MagicMock()

        # Dependency overrides
        app.dependency_overrides[get_current_active_user] = lambda: self.mock_user
        app.dependency_overrides[get_broker_order_service] = lambda: self.mock_service

    def tearDown(self):
        app.dependency_overrides = {}

    def test_place_order_success(self):
        """A, B, C, D, E: POST place order returns 201 and maps DTOs correctly."""
        payload = {
            "symbol": "INFY",
            "exchange": "NSE",
            "quantity": "10.0",
            "side": "BUY",
            "order_type": "LIMIT",
            "product": "CNC",
            "variety": "regular",
            "price": "1500.50"
        }

        domain_order = BrokerOrder(
            order_id="ORD-100",
            symbol="INFY",
            side="BUY",
            quantity=Decimal("10.0"),
            status="complete"
        )
        self.mock_service.place_order.return_value = domain_order

        response = client.post(f"/api/v1/broker-orders/{self.broker_id}", json=payload)

        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["order_id"], "ORD-100")
        self.assertEqual(data["symbol"], "INFY")
        self.assertEqual(data["side"], "BUY")
        self.assertEqual(data["quantity"], "10.0")
        self.assertEqual(data["status"], "complete")

        # B & C: Check service called with user_id and broker_id
        self.mock_service.place_order.assert_called_once()
        call_kwargs = self.mock_service.place_order.call_args.kwargs
        self.assertEqual(call_kwargs["user_id"], self.user_id)
        self.assertEqual(call_kwargs["broker_id"], self.broker_id)
        # D: Check BrokerOrderRequest mapping
        domain_req = call_kwargs["request"]
        self.assertEqual(domain_req.symbol, "INFY")
        self.assertEqual(domain_req.price, Decimal("1500.50"))

    def test_modify_order_success(self):
        """F & G: PUT modify order returns 200 and passes order_id correctly."""
        payload = {
            "symbol": "INFY",
            "exchange": "NSE",
            "quantity": "15.0",
            "side": "BUY",
            "order_type": "LIMIT",
            "product": "CNC",
            "variety": "regular",
            "price": "1510.00"
        }
        domain_result = BrokerOrderActionResult(order_id="ORD-100", success=True)
        self.mock_service.modify_order.return_value = domain_result

        response = client.put(f"/api/v1/broker-orders/{self.broker_id}/ORD-100", json=payload)

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["order_id"], "ORD-100")
        self.assertTrue(data["success"])

        call_kwargs = self.mock_service.modify_order.call_args.kwargs
        self.assertEqual(call_kwargs["user_id"], self.user_id)
        self.assertEqual(call_kwargs["broker_id"], self.broker_id)
        self.assertEqual(call_kwargs["order_id"], "ORD-100")

    def test_cancel_order_success(self):
        """H & I: POST cancel endpoint returns 200 and passes parameters correctly."""
        domain_result = BrokerOrderActionResult(order_id="ORD-100", success=True)
        self.mock_service.cancel_order.return_value = domain_result

        response = client.post(f"/api/v1/broker-orders/{self.broker_id}/ORD-100/cancel")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["order_id"], "ORD-100")
        self.assertTrue(data["success"])

        call_kwargs = self.mock_service.cancel_order.call_args.kwargs
        self.assertEqual(call_kwargs["user_id"], self.user_id)
        self.assertEqual(call_kwargs["broker_id"], self.broker_id)
        self.assertEqual(call_kwargs["request"].order_id, "ORD-100")

    def test_get_orders_success(self):
        """J & P: GET orders returns 200 and serialized order list under /api/v1/broker-orders."""
        domain_orders = [
            BrokerOrder(order_id="ORD-100", symbol="INFY", side="BUY", quantity=Decimal("10.0"), status="complete")
        ]
        self.mock_service.get_orders.return_value = domain_orders

        response = client.get(f"/api/v1/broker-orders/{self.broker_id}")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["order_id"], "ORD-100")

    def test_authentication_required(self):
        """K: Unauthenticated request returns 401."""
        from app.exceptions.auth_exceptions import UnauthorizedException

        def raise_unauthorized():
            raise UnauthorizedException()

        app.dependency_overrides[get_current_active_user] = raise_unauthorized

        response = client.get(f"/api/v1/broker-orders/{self.broker_id}")
        self.assertEqual(response.status_code, 401)

    def test_validation_error_returns_422(self):
        """M: Invalid request payload returns 422."""
        invalid_payload = {
            "symbol": "",
            "exchange": "NSE",
            "quantity": "10.0"
        }
        response = client.post(f"/api/v1/broker-orders/{self.broker_id}", json=invalid_payload)
        self.assertEqual(response.status_code, 422)


    def test_service_exceptions_propagation(self):
        """L: Domain exceptions propagate to app exception handlers correctly."""
        # BrokerNotFound -> 404
        self.mock_service.get_orders.side_effect = BrokerNotFoundException(str(self.broker_id))
        resp = client.get(f"/api/v1/broker-orders/{self.broker_id}")
        self.assertEqual(resp.status_code, 404)

        # BrokerSessionExpired -> 401
        self.mock_service.get_orders.side_effect = BrokerSessionExpiredException("Token expired")
        resp = client.get(f"/api/v1/broker-orders/{self.broker_id}")
        self.assertEqual(resp.status_code, 401)

        # BrokerOrderException -> 400
        self.mock_service.place_order.side_effect = BrokerOrderException("Insufficient funds")
        payload = {
            "symbol": "INFY", "exchange": "NSE", "quantity": "10.0",
            "side": "BUY", "order_type": "LIMIT", "product": "CNC"
        }
        resp = client.post(f"/api/v1/broker-orders/{self.broker_id}", json=payload)
        self.assertEqual(resp.status_code, 400)

        # BrokerNetworkException -> 503
        self.mock_service.get_orders.side_effect = BrokerNetworkException("Connection timed out")
        resp = client.get(f"/api/v1/broker-orders/{self.broker_id}")
        self.assertEqual(resp.status_code, 503)

    @patch("app.brokers.providers.zerodha.zerodha_broker.ZerodhaBroker")
    @patch("app.brokers.providers.zerodha.zerodha_broker.KiteConnect")
    def test_route_does_not_instantiate_zerodha_or_kite(self, mock_kite, mock_zerodha):
        """N & O: Route never instantiates ZerodhaBroker or KiteConnect directly."""
        self.mock_service.get_orders.return_value = []
        response = client.get(f"/api/v1/broker-orders/{self.broker_id}")
        self.assertEqual(response.status_code, 200)

        mock_zerodha.assert_not_called()
        mock_kite.assert_not_called()


if __name__ == '__main__':
    unittest.main()
