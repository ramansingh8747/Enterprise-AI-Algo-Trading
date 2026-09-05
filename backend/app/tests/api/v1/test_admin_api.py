"""
Tests for Admin API endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock
import uuid

from app.main import app
from app.database.models.user import UserRole
from app.dependencies.auth import get_current_active_user

client = TestClient(app)

def test_list_users_unauthenticated():
    response = client.get("/api/v1/admin/users")
    assert response.status_code == 401

def test_list_users_trader_forbidden():
    trader_user = MagicMock()
    trader_user.id = uuid.uuid4()
    trader_user.role = UserRole.TRADER
    trader_user.is_active = True

    app.dependency_overrides[get_current_active_user] = lambda: trader_user
    try:
        response = client.get("/api/v1/admin/users")
        assert response.status_code == 403
    finally:
        app.dependency_overrides = {}

def test_list_users_admin_success():
    admin_user = MagicMock()
    admin_user.id = uuid.uuid4()
    admin_user.role = UserRole.ADMIN
    admin_user.is_active = True

    app.dependency_overrides[get_current_active_user] = lambda: admin_user
    try:
        response = client.get("/api/v1/admin/users?skip=0&limit=10")
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "items" in data
        assert isinstance(data["items"], list)
    finally:
        app.dependency_overrides = {}


def test_system_health_unauthenticated():
    response = client.get("/api/v1/admin/system-health")
    assert response.status_code == 401


def test_system_health_trader_forbidden():
    trader_user = MagicMock()
    trader_user.id = uuid.uuid4()
    trader_user.role = UserRole.TRADER
    trader_user.is_active = True

    app.dependency_overrides[get_current_active_user] = lambda: trader_user
    try:
        response = client.get("/api/v1/admin/system-health")
        assert response.status_code == 403
    finally:
        app.dependency_overrides = {}


def test_admin_brokers_unauthenticated():
    response = client.get("/api/v1/admin/brokers")
    assert response.status_code == 401


def test_admin_brokers_trader_forbidden():
    trader_user = MagicMock()
    trader_user.id = uuid.uuid4()
    trader_user.role = UserRole.TRADER
    trader_user.is_active = True

    app.dependency_overrides[get_current_active_user] = lambda: trader_user
    try:
        response = client.get("/api/v1/admin/brokers")
        assert response.status_code == 403
    finally:
        app.dependency_overrides = {}
