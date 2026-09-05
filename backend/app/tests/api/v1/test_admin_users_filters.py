"""Focused tests for the Admin Control Center user-list contract."""

from unittest.mock import MagicMock
import uuid

from fastapi.testclient import TestClient

from app.database.models.user import UserRole
from app.dependencies.auth import get_current_active_user
from app.main import app

client = TestClient(app)


def _admin():
    user = MagicMock()
    user.id = uuid.uuid4()
    user.role = UserRole.ADMIN
    user.is_active = True
    return user


def _trader():
    user = MagicMock()
    user.id = uuid.uuid4()
    user.role = UserRole.TRADER
    user.is_active = True
    return user


def test_admin_users_requires_authentication():
    response = client.get('/api/v1/admin/users')
    assert response.status_code == 401


def test_admin_users_rejects_trader():
    app.dependency_overrides[get_current_active_user] = _trader
    try:
        response = client.get('/api/v1/admin/users')
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_active_user, None)


def test_admin_users_rejects_invalid_pagination():
    app.dependency_overrides[get_current_active_user] = _admin
    try:
        assert client.get('/api/v1/admin/users?limit=0').status_code == 422
        assert client.get('/api/v1/admin/users?limit=101').status_code == 422
        assert client.get('/api/v1/admin/users?skip=-1').status_code == 422
    finally:
        app.dependency_overrides.pop(get_current_active_user, None)
