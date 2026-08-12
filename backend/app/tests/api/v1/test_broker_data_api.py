import unittest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from uuid import uuid4
from decimal import Decimal
from app.main import app
from app.dependencies.auth import get_current_active_user
from app.dependencies.broker_session import get_broker_session_service
from app.dependencies.broker import get_broker_service
from app.services.broker_service import BrokerService
from app.brokers.providers.zerodha.zerodha_broker import ZerodhaBroker
from app.core.security.jwt_service import JwtService

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
        self.mock_user.is_active = True

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

        # Setup Broker Session Service Mock
        self.mock_session_service = MagicMock()

        # Setup overrides
        app.dependency_overrides[get_current_active_user] = lambda: self.mock_user
        app.dependency_overrides[get_broker_session_service] = lambda: self.mock_session_service
        
        # Setup Broker Repository Mock
        self.mock_repo = MagicMock()
        self.mock_repo.get_by_id.return_value = self.mock_broker
        
        # Setup Broker Service Mock
        self.mock_factory = MagicMock()
        self.mock_zerodha_client = MagicMock()
        self.mock_zerodha_broker = ZerodhaBroker(
            session_service=self.mock_session_service,
            broker_id=self.broker_id,
            client=self.mock_zerodha_client
        )
        self.mock_service = BrokerService(
            repository=self.mock_repo,
            session_service=self.mock_session_service,
            broker_factory=self.mock_factory
        )
        app.dependency_overrides[get_broker_service] = lambda: self.mock_service

        # Auth headers
        self.token = JwtService.create_access_token(str(self.user_id))
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def tearDown(self):
        app.dependency_overrides = {}

    def test_all_read_only_endpoints_success(self):
        self.mock_session_service.get_active_session.return_value = self.mock_session

        mock_client = self.mock_zerodha_client
        mock_client.profile.return_value = {"user_id": "U12345", "user_type": "individual"}
        mock_client.holdings.return_value = [{"tradingsymbol": "RELIANCE", "quantity": 1, "average_price": 2000}]
        mock_client.positions.return_value = {"net": [{"tradingsymbol": "RELIANCE", "quantity": 1, "average_price": 2000, "side": 1}]}
        mock_client.orders.return_value = [{"order_id": "1", "tradingsymbol": "RELIANCE", "transaction_type": "BUY", "quantity": 1, "status": "COMPLETE"}]
        mock_client.quote.return_value = {"RELIANCE": {"last_price": 2000, "depth": {"buy": [{"price": 1999}], "sell": [{"price": 2001}]}}}
        
        self.mock_factory.get_provider.return_value = self.mock_zerodha_broker

        # Profile
        resp = client.get(f"/api/v1/broker-data/{self.broker_id}/profile", headers=self.headers)
        self.assertEqual(resp.status_code, 200)

        # Holdings
        resp = client.get(f"/api/v1/broker-data/{self.broker_id}/holdings", headers=self.headers)
        self.assertEqual(resp.status_code, 200)

        # Positions
        resp = client.get(f"/api/v1/broker-data/{self.broker_id}/positions", headers=self.headers)
        self.assertEqual(resp.status_code, 200)

        # Orders
        resp = client.get(f"/api/v1/broker-data/{self.broker_id}/orders", headers=self.headers)
        self.assertEqual(resp.status_code, 200)

        # Quotes
        resp = client.get(f"/api/v1/broker-data/{self.broker_id}/quotes?symbols=RELIANCE&symbols=TCS", headers=self.headers)
        self.assertEqual(resp.status_code, 200)

    def test_cross_user_isolation(self):
        self.mock_session_service.get_active_session.return_value = None

        response = client.get(f"/api/v1/broker-data/{self.broker_id}/profile", headers=self.headers)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["message"], "No active session found for this broker.")

    def test_exception_mapping_network(self):
        self.mock_session_service.get_active_session.return_value = self.mock_session

        mock_client = self.mock_zerodha_client
        from kiteconnect.exceptions import NetworkException
        mock_client.profile.side_effect = NetworkException("network error")
        
        self.mock_factory.get_provider.return_value = self.mock_zerodha_broker

        response = client.get(f"/api/v1/broker-data/{self.broker_id}/profile", headers=self.headers)
        self.assertEqual(response.status_code, 503)
