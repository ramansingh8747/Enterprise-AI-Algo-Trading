import unittest
from unittest.mock import MagicMock, patch
from uuid import uuid4
from decimal import Decimal

from app.services.broker_order_service import BrokerOrderService
from app.brokers.base.broker_types import (
    BrokerOrderRequest, BrokerOrder, BrokerOrderActionResult, BrokerCancelOrderRequest
)
from app.exceptions.auth_exceptions import BrokerNotFoundException
from app.exceptions.broker_exceptions import BrokerOrderException, BrokerSessionExpiredException


class TestBrokerOrderService(unittest.TestCase):
    def setUp(self):
        self.user_id = uuid4()
        self.broker_id = uuid4()

        self.mock_session_service = MagicMock()
        self.mock_broker_service = MagicMock()
        self.mock_broker_factory = MagicMock()

        # Mock broker model returned by BrokerService
        self.mock_broker_model = MagicMock()
        self.mock_broker_model.broker_name = "zerodha"
        self.mock_broker_model.broker_type = "zerodha"
        self.mock_broker_service.get_broker.return_value = self.mock_broker_model

        # Mock concrete BrokerInterface provider returned by BrokerFactory
        self.mock_provider = MagicMock()
        self.mock_broker_factory.get_provider.return_value = self.mock_provider

        # Instantiate BrokerOrderService using injected dependencies
        self.service = BrokerOrderService(
            session_service=self.mock_session_service,
            broker_service=self.mock_broker_service,
            broker_factory=self.mock_broker_factory
        )

    def test_place_order_success(self):
        """A & E & F: place_order delegates correctly, sets user context, passes args to BrokerFactory."""
        req = BrokerOrderRequest(
            symbol="INFY", exchange="NSE", quantity=Decimal("10"),
            side="buy", order_type="LIMIT", product="CNC", variety="regular",
            price=Decimal("1500.0")
        )
        expected_order = BrokerOrder(
            order_id="ORD-100", symbol="INFY", side="buy",
            quantity=Decimal("10"), status="complete"
        )
        self.mock_provider.place_order.return_value = expected_order

        result = self.service.place_order(self.user_id, self.broker_id, req)

        # F: BrokerFactory received correct provider_name, session_service, broker_id
        self.mock_broker_factory.get_provider.assert_called_once_with(
            provider_name="zerodha",
            session_service=self.mock_session_service,
            broker_id=self.broker_id,
            client=None
        )
        # E: User context set on provider
        self.mock_provider.set_user_context.assert_called_once_with(self.user_id)
        # A: Delegated to provider.place_order
        self.mock_provider.place_order.assert_called_once_with(req)
        self.assertEqual(result, expected_order)

    def test_modify_order_success(self):
        """B: modify_order delegates correctly to provider and returns BrokerOrderActionResult."""
        req = BrokerOrderRequest(
            symbol="INFY", exchange="NSE", quantity=Decimal("15"),
            side="buy", order_type="LIMIT", product="CNC", variety="regular",
            price=Decimal("1505.0")
        )
        expected_res = BrokerOrderActionResult(order_id="ORD-100", success=True)
        self.mock_provider.modify_order.return_value = expected_res

        result = self.service.modify_order(self.user_id, self.broker_id, "ORD-100", req)

        self.mock_provider.modify_order.assert_called_once_with("ORD-100", req)
        self.assertEqual(result, expected_res)

    def test_cancel_order_success(self):
        """C: cancel_order delegates correctly to provider and returns BrokerOrderActionResult."""
        req = BrokerCancelOrderRequest(order_id="ORD-100", variety="regular")
        expected_res = BrokerOrderActionResult(order_id="ORD-100", success=True)
        self.mock_provider.cancel_order.return_value = expected_res

        result = self.service.cancel_order(self.user_id, self.broker_id, req)

        self.mock_provider.cancel_order.assert_called_once_with(req)
        self.assertEqual(result, expected_res)

    def test_get_orders_success(self):
        """D: get_orders delegates correctly to provider and returns list of orders."""
        expected_orders = [
            BrokerOrder(order_id="ORD-100", symbol="INFY", side="buy", quantity=Decimal("10"), status="complete")
        ]
        self.mock_provider.get_orders.return_value = expected_orders

        result = self.service.get_orders(self.user_id, self.broker_id)

        self.mock_provider.get_orders.assert_called_once()
        self.assertEqual(result, expected_orders)

    def test_place_order_with_custom_client(self):
        """B & F: Passing custom client propagates client to BrokerFactory."""
        mock_client = MagicMock()
        req = BrokerOrderRequest(
            symbol="INFY", exchange="NSE", quantity=Decimal("10"),
            side="buy", order_type="LIMIT", product="CNC", variety="regular"
        )
        self.service.place_order(self.user_id, self.broker_id, req, client=mock_client)

        self.mock_broker_factory.get_provider.assert_called_once_with(
            provider_name="zerodha",
            session_service=self.mock_session_service,
            broker_id=self.broker_id,
            client=mock_client
        )

    def test_broker_not_found_error_propagates(self):
        """H: BrokerService throwing BrokerNotFoundException propagates unchanged."""
        self.mock_broker_service.get_broker.side_effect = BrokerNotFoundException(str(self.broker_id))
        req = BrokerOrderRequest(
            symbol="INFY", exchange="NSE", quantity=Decimal("10"),
            side="buy", order_type="LIMIT", product="CNC", variety="regular"
        )

        with self.assertRaises(BrokerNotFoundException):
            self.service.place_order(self.user_id, self.broker_id, req)

    def test_provider_order_exception_propagates(self):
        """G: Provider throwing BrokerOrderException propagates unchanged."""
        self.mock_provider.place_order.side_effect = BrokerOrderException("Order rejected")
        req = BrokerOrderRequest(
            symbol="INFY", exchange="NSE", quantity=Decimal("10"),
            side="buy", order_type="LIMIT", product="CNC", variety="regular"
        )

        with self.assertRaises(BrokerOrderException):
            self.service.place_order(self.user_id, self.broker_id, req)

    def test_session_expired_exception_propagates(self):
        """G & H: Session expired exception propagates unchanged."""
        self.mock_provider.get_orders.side_effect = BrokerSessionExpiredException("Token expired")

        with self.assertRaises(BrokerSessionExpiredException):
            self.service.get_orders(self.user_id, self.broker_id)

    def test_factory_value_error_propagates(self):
        """G: BrokerFactory throwing ValueError (missing dependencies or invalid provider) propagates."""
        self.mock_broker_factory.get_provider.side_effect = ValueError("Unsupported broker provider: invalid")

        with self.assertRaises(ValueError):
            self.service.get_orders(self.user_id, self.broker_id)

    @patch("app.brokers.providers.zerodha.zerodha_broker.ZerodhaBroker")
    def test_service_never_directly_constructs_zerodha_broker(self, mock_zerodha_cls):
        """I & J: Service uses BrokerFactory and never directly instantiates ZerodhaBroker or KiteConnect."""
        req = BrokerOrderRequest(
            symbol="INFY", exchange="NSE", quantity=Decimal("10"),
            side="buy", order_type="LIMIT", product="CNC", variety="regular"
        )
        self.service.place_order(self.user_id, self.broker_id, req)

        # ZerodhaBroker constructor was never directly invoked by BrokerOrderService
        mock_zerodha_cls.assert_not_called()


if __name__ == '__main__':
    unittest.main()
