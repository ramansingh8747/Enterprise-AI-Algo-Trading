from fastapi.testclient import TestClient
from unittest.mock import MagicMock
from app.main import app
from app.database.models.user import UserRole
import unittest
from uuid import uuid4

client = TestClient(app)

class TestBrokerAuth(unittest.TestCase):
    def tearDown(self):
        app.dependency_overrides = {}

    def test_admin_broker_endpoints_require_admin(self):
        # Test that ADMIN is required for broker management
        # Without auth token, this returns 401
        response = client.get("/api/v1/brokers")
        assert response.status_code == 401

    def test_read_only_broker_endpoints_require_auth(self):
        # Test that AUTH is required for broker data
        broker_id = uuid4()
        response = client.get(f"/api/v1/broker-data/{broker_id}/profile")
        assert response.status_code == 401
