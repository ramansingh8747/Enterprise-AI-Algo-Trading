import unittest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from uuid import uuid4
from decimal import Decimal
from app.main import app
from app.dependencies.auth import get_current_active_user
from app.dependencies.broker_session import get_broker_session_service
from app.dependencies.database import get_db

# Create test client
client = TestClient(app)

class TestBrokerDataAPI(unittest.TestCase):
    def setUp(self):
        self.user_id = uuid4()
        self.broker_id = uuid4()
        self.session_id = uuid4()

        # Mock User
        self.mock_user = MagicMock()
        self.mock_user.id = self.user_id

        # Mock Session
        self.mock_session = MagicMock()
        self.mock_session.user_id = self.user_id
        self.mock_session.broker_id = self.broker_id
        self.mock_session.access_token = "fake_encrypted_token"

        # Mock Broker
        self.mock_broker = MagicMock()
        self.mock_broker.id = self.broker_id
        self.mock_broker.broker_type = "zerodha"
        self.mock_broker.is_active = True

        # Setup overrides
        app.dependency_overrides[get_current_active_user] = lambda: self.mock_user

    def tearDown(self):
        app.dependency_overrides = {}

    @patch('app.dependencies.broker_provider.BrokerRepository')
    @patch('app.brokers.providers.zerodha.zerodha_broker.KiteConnect')
    def test_all_read_only_endpoints_success(self, MockKiteConnect, MockBrokerRepository):
        # Setup Mocks
        mock_repo = MockBrokerRepository.return_value
        mock_repo.get_by_id.return_value = self.mock_broker

        mock_session_service = MagicMock()
        mock_session_service.get_active_session.return_value = self.mock_session
        app.dependency_overrides[get_broker_session_service] = lambda: mock_session_service

        mock_client = MockKiteConnect.return_value
        mock_client.profile.return_value = {"user_id": "U12345", "user_type": "individual"}
        mock_client.holdings.return_value = [{"tradingsymbol": "RELIANCE", "quantity": 1, "average_price": 2000}]
        mock_client.positions.return_value = {"net": [{"tradingsymbol": "RELIANCE", "quantity": 1, "average_price": 2000}]}
        mock_client.orders.return_value = [{"order_id": "1", "tradingsymbol": "RELIANCE", "transaction_type": "BUY", "quantity": 1, "status": "COMPLETE"}]
        mock_client.quote.return_value = {"RELIANCE": {"last_price": 2000, "depth": {"buy": [{"price": 1999}], "sell": [{"price": 2001}]}}}

        # Profile
        resp = client.get(f"/api/v1/broker-data/{self.broker_id}/profile")
        self.assertEqual(resp.status_code, 200)

        # Holdings
        resp = client.get(f"/api/v1/broker-data/{self.broker_id}/holdings")
        self.assertEqual(resp.status_code, 200)

        # Positions
        resp = client.get(f"/api/v1/broker-data/{self.broker_id}/positions")
        self.assertEqual(resp.status_code, 200)

        # Orders
        resp = client.get(f"/api/v1/broker-data/{self.broker_id}/orders")
        self.assertEqual(resp.status_code, 200)

        # Quotes
        resp = client.get(f"/api/v1/broker-data/{self.broker_id}/quotes?symbols=RELIANCE&symbols=TCS")
        if resp.status_code != 200:
            print(resp.json())
        self.assertEqual(resp.status_code, 200)

    @patch('app.dependencies.broker_provider.BrokerRepository')
    @patch('app.brokers.providers.zerodha.zerodha_broker.KiteConnect')
    def test_cross_user_isolation(self, MockKiteConnect, MockBrokerRepository):
        mock_repo = MockBrokerRepository.return_value
        mock_repo.get_by_id.return_value = self.mock_broker

        mock_session_service = MagicMock()
        mock_session_service.get_active_session.return_value = None
        app.dependency_overrides[get_broker_session_service] = lambda: mock_session_service

        response = client.get(f"/api/v1/broker-data/{self.broker_id}/profile")
        self.assertEqual(response.status_code, 401)

        mock_client = MockKiteConnect.return_value
        mock_client.profile.assert_not_called()

    @patch('app.dependencies.broker_provider.BrokerRepository')
    @patch('app.brokers.providers.zerodha.zerodha_broker.KiteConnect')
    def test_exception_mapping_network(self, MockKiteConnect, MockBrokerRepository):
        mock_repo = MockBrokerRepository.return_value
        mock_repo.get_by_id.return_value = self.mock_broker

        mock_session_service = MagicMock()
        mock_session_service.get_active_session.return_value = self.mock_session
        app.dependency_overrides[get_broker_session_service] = lambda: mock_session_service

        mock_client = MockKiteConnect.return_value
        from kiteconnect.exceptions import NetworkException
        mock_client.profile.side_effect = NetworkException("network error")

        response = client.get(f"/api/v1/broker-data/{self.broker_id}/profile")
        self.assertEqual(response.status_code, 503)
        mock_client.set_access_token.assert_any_call(None)
