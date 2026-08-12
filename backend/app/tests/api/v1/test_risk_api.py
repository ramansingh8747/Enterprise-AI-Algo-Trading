"""
Backend REST API tests for Emergency Kill Switch admin endpoints (Step 13.21I.34.125 — GAP-007).
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app

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
