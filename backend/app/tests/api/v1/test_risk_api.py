"""
Backend REST API tests for Emergency Kill Switch admin endpoints (Step 13.21I.34.125 — GAP-007).
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock
import uuid

from app.main import app
from app.database.models.user import UserRole
from app.dependencies.auth import get_current_active_user

client = TestClient(app)


def test_get_kill_switch_status_unauthenticated():
    response = client.get("/api/v1/admin/risk/kill-switch")
    assert response.status_code == 401


def test_activate_kill_switch_unauthenticated():
    response = client.post("/api/v1/admin/risk/kill-switch/activate")
    assert response.status_code == 401


def test_deactivate_kill_switch_unauthenticated():
    response = client.post("/api/v1/admin/risk/kill-switch/deactivate")
    assert response.status_code == 401

def test_get_kill_switch_status_trader_forbidden():
    trader_user = MagicMock()
    trader_user.id = uuid.uuid4()
    trader_user.role = UserRole.TRADER
    trader_user.is_active = True

    app.dependency_overrides[get_current_active_user] = lambda: trader_user
    try:
        response = client.get("/api/v1/admin/risk/kill-switch")
        assert response.status_code == 403
    finally:
        app.dependency_overrides = {}

def test_get_kill_switch_status_admin_success():
    admin_user = MagicMock()
    admin_user.id = uuid.uuid4()
    admin_user.role = UserRole.ADMIN
    admin_user.is_active = True

    app.dependency_overrides[get_current_active_user] = lambda: admin_user
    try:
        response = client.get("/api/v1/admin/risk/kill-switch")
        assert response.status_code == 200
    finally:
        app.dependency_overrides = {}
