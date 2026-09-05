"""Tests for the ADMIN overview aggregation endpoint."""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from app.main import app
from app.dependencies.auth import get_current_active_user
from app.api.v1.routes.admin_overview import get_admin_overview_service
from app.database.models.user import UserRole
from app.schemas.admin_overview import AdminOverviewMetrics, AdminOverviewResponse

client = TestClient(app)


def _admin_user():
    user = MagicMock()
    user.id = uuid.uuid4()
    user.role = UserRole.ADMIN
    user.is_active = True
    return user


def _overview() -> AdminOverviewResponse:
    return AdminOverviewResponse(
        generated_at=datetime.now(timezone.utc),
        overall_status="UP",
        live_trading_enabled=False,
        strategy_scheduler_enabled=False,
        metrics=AdminOverviewMetrics(
            total_users=10,
            active_users=9,
            admin_users=1,
            total_brokers=3,
            active_brokers=2,
            connected_brokers=1,
            total_orders=20,
            open_orders=2,
            today_orders=4,
            total_strategies=5,
            running_strategies=2,
            paper_portfolios=4,
            open_paper_positions=7,
            paper_realized_pnl=Decimal("1000"),
            paper_unrealized_pnl=Decimal("250"),
            kill_switch_active=False,
        ),
    )


def test_admin_overview_requires_admin_role():
    trader = MagicMock()
    trader.id = uuid.uuid4()
    trader.role = UserRole.TRADER
    trader.is_active = True
    app.dependency_overrides[get_current_active_user] = lambda: trader
    try:
        response = client.get("/api/v1/admin/overview")
        assert response.status_code == 403
    finally:
        app.dependency_overrides = {}


def test_admin_overview_returns_backend_snapshot():
    admin = _admin_user()
    service = MagicMock()
    service.build.return_value = _overview()

    app.dependency_overrides[get_current_active_user] = lambda: admin
    app.dependency_overrides[get_admin_overview_service] = lambda: service
    try:
        response = client.get("/api/v1/admin/overview")
        assert response.status_code == 200
        data = response.json()
        assert data["overall_status"] == "UP"
        assert data["live_trading_enabled"] is False
        assert data["metrics"]["total_users"] == 10
        assert data["metrics"]["connected_brokers"] == 1
        assert data["metrics"]["open_orders"] == 2
        assert data["metrics"]["running_strategies"] == 2
        assert data["metrics"]["paper_realized_pnl"] == "1000"
        service.build.assert_called_once()
    finally:
        app.dependency_overrides = {}
