import unittest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from uuid import uuid4
from datetime import datetime, timezone, timedelta
from app.main import app
from app.database.models.broker_session import BrokerSession
from app.services.interfaces.broker_session_service import BrokerSessionServiceInterface
from app.dependencies.broker_session import get_broker_session_service
from app.api.v1.routes.auth import get_current_active_user
from app.database.models.user import UserRole
from app.schemas.auth import UserResponse

# Setup TestClient
client = TestClient(app)

# Mock Service
mock_service = MagicMock(spec=BrokerSessionServiceInterface)

# Mock Current User
mock_user = UserResponse(
    id=uuid4(),
    email="test@example.com",
    username="testuser",
    full_name="Test User",
    role=UserRole.TRADER,
    is_active=True,
    is_verified=True,
    last_login=datetime.now(timezone.utc),
    created_at=datetime.now(timezone.utc),
    updated_at=datetime.now(timezone.utc)
)

class TestBrokerSessionAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.dependency_overrides[get_broker_session_service] = lambda: mock_service
        app.dependency_overrides[get_current_active_user] = lambda: mock_user

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides = {}

    def setUp(self):
        mock_service.reset_mock()

    def test_create_session_success(self):
        broker_id = uuid4()
        payload = {
            "broker_id": str(broker_id),
            "access_token": "plaintext",
            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        }

        mock_service.create_or_update_session.return_value = BrokerSession(
            id=uuid4(), user_id=mock_user.id, broker_id=broker_id,
            access_token="ignored", expires_at=datetime.fromisoformat(payload["expires_at"])
        )

        response = client.post("/api/v1/broker-sessions", json=payload)

        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertNotIn("access_token", data)
        self.assertEqual(data["broker_id"], str(broker_id))
        mock_service.create_or_update_session.assert_called_once()

    def test_get_session_success(self):
        broker_id = uuid4()
        mock_service.get_active_session.return_value = BrokerSession(
            id=uuid4(), user_id=mock_user.id, broker_id=broker_id,
            access_token="decrypted", expires_at=datetime.now(timezone.utc) + timedelta(hours=1)
        )

        response = client.get(f"/api/v1/broker-sessions/{broker_id}")

        self.assertEqual(response.status_code, 200)
        self.assertNotIn("access_token", response.json())

    def test_delete_session_success(self):
        session_id = uuid4()
        mock_session = BrokerSession(id=session_id, user_id=mock_user.id, broker_id=uuid4(), access_token="x", expires_at=datetime.now())
        mock_service.get_session.return_value = mock_session

        response = client.delete(f"/api/v1/broker-sessions/{session_id}")

        self.assertEqual(response.status_code, 204)
        mock_service.revoke_session.assert_called_once_with(session_id)

    def test_delete_session_unauthorized(self):
        session_id = uuid4()
        other_user_id = uuid4()
        mock_session = BrokerSession(id=session_id, user_id=other_user_id, broker_id=uuid4(), access_token="x", expires_at=datetime.now())
        mock_service.get_session.return_value = mock_session

        response = client.delete(f"/api/v1/broker-sessions/{session_id}")

        self.assertEqual(response.status_code, 404)
        mock_service.revoke_session.assert_not_called()

    def test_create_session_update(self):
        broker_id = uuid4()
        payload = {
            "broker_id": str(broker_id),
            "access_token": "plaintext2",
            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
        }

        mock_service.create_or_update_session.return_value = BrokerSession(
            id=uuid4(), user_id=mock_user.id, broker_id=broker_id,
            access_token="ignored", expires_at=datetime.fromisoformat(payload["expires_at"])
        )

        response = client.post("/api/v1/broker-sessions", json=payload)

        self.assertEqual(response.status_code, 201)
        mock_service.create_or_update_session.assert_called_once_with(
            user_id=mock_user.id,
            broker_id=broker_id,
            access_token="plaintext2",
            expires_at=datetime.fromisoformat(payload["expires_at"])
        )

    def test_get_session_not_found(self):
        broker_id = uuid4()
        mock_service.get_active_session.return_value = None

        response = client.get(f"/api/v1/broker-sessions/{broker_id}")

        self.assertEqual(response.status_code, 404)

    def test_delete_session_not_found(self):
        session_id = uuid4()
        mock_service.get_session.return_value = None

        response = client.delete(f"/api/v1/broker-sessions/{session_id}")

        self.assertEqual(response.status_code, 404)

    def test_unauthenticated_request(self):
        from app.dependencies.auth import get_current_active_user
        from app.exceptions.auth_exceptions import UnauthorizedException

        # Override get_current_active_user to raise UnauthorizedException
        def raise_unauthorized():
            raise UnauthorizedException()

        app.dependency_overrides[get_current_active_user] = raise_unauthorized

        try:
            response = client.get(f"/api/v1/broker-sessions/{uuid4()}")
            self.assertEqual(response.status_code, 401)
        finally:
            # Clean up override
            app.dependency_overrides[get_current_active_user] = lambda: mock_user

if __name__ == '__main__':
    unittest.main()
