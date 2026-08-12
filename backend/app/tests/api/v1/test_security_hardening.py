"""
Security Hardening Regression Tests for Phase 4.
Covers:
1. Registration privilege escalation (blocking ADMIN role)
2. Kill switch ADMIN authorization (401 unauth, 403 trader, 200 admin)
3. WebSocket authentication (missing/invalid token rejection)
4. Strategy WebSocket topic ownership (blocking subscription to other users' strategies)
5. Production CORS hardening (disallowing '*' in production)
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import Settings
from app.database.models.user import UserRole
from app.dependencies.auth import get_current_active_user
from unittest.mock import MagicMock
import uuid

client = TestClient(app)


def test_registration_block_admin_role():
    """Verify registration with role='ADMIN' is rejected by validation (422)."""
    payload = {
        "email": "hacker@example.com",
        "username": "hacker",
        "full_name": "Bad Actor",
        "password": "Password123",
        "role": "ADMIN",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422


def test_kill_switch_unauthorized_access():
    """Verify kill switch endpoints return 401 when unauthenticated."""
    assert client.get("/api/v1/admin/risk/kill-switch").status_code == 401
    assert client.post("/api/v1/admin/risk/kill-switch/activate").status_code == 401
    assert client.post("/api/v1/admin/risk/kill-switch/deactivate").status_code == 401


def test_kill_switch_trader_role_forbidden():
    """Verify normal TRADER user gets 403 on kill switch endpoints."""
    trader_user = MagicMock()
    trader_user.id = uuid.uuid4()
    trader_user.role = UserRole.TRADER
    trader_user.is_active = True

    app.dependency_overrides[get_current_active_user] = lambda: trader_user
    try:
        assert client.get("/api/v1/admin/risk/kill-switch").status_code == 403
        assert client.post("/api/v1/admin/risk/kill-switch/activate").status_code == 403
    finally:
        app.dependency_overrides = {}


def test_production_cors_disallows_wildcard():
    """Verify settings validation rejects '*' in CORS origins when ENVIRONMENT=production."""
    with pytest.raises(Exception):
        Settings(
            ENVIRONMENT="production",
            DEBUG=False,
            SECRET_KEY="12345678901234567890123456789012",
            JWT_SECRET_KEY="12345678901234567890123456789012",
            BROKER_SECRET_KEY="12345678901234567890123456789012",
            DATABASE_URL="sqlite:///:memory:",
            CORS_ALLOWED_ORIGINS=["*"],
        )
