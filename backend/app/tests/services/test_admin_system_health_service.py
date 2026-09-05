from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock
from uuid import uuid4

from app.services.admin_system_health_service import AdminSystemHealthService


def _broker(active=True):
    broker = MagicMock()
    broker.id = uuid4()
    broker.broker_name = "Zerodha"
    broker.broker_type = "zerodha"
    broker.is_active = active
    return broker


def test_admin_system_health_reports_database_redis_websocket_and_broker_session(monkeypatch):
    monkeypatch.setattr("app.services.admin_system_health_service.settings.REDIS_EVENT_BUS_ENABLED", True)
    monkeypatch.setattr("app.services.admin_system_health_service.settings.LIVE_TRADING_ENABLED", False)
    monkeypatch.setattr("app.services.admin_system_health_service.settings.STRATEGY_SCHEDULER_ENABLED", False)

    db = MagicMock()
    db.execute.return_value = MagicMock()

    broker = _broker()
    session = MagicMock()
    session.expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    query = MagicMock()
    query.order_by.return_value.all.return_value = [broker]
    db.query.return_value = query
    query.filter.return_value.first.return_value = session

    redis_transport = MagicMock()
    redis_transport.is_connected = True

    websocket_manager = MagicMock()
    websocket_manager.active_connections = {uuid4(): {MagicMock(), MagicMock()}}

    response = AdminSystemHealthService(
        db=db,
        redis_transport=redis_transport,
        websocket_manager=websocket_manager,
    ).check()

    assert response.overall_status == "UP"
    assert response.live_trading_enabled is False
    assert response.strategy_scheduler_enabled is False
    assert {component.name for component in response.components} == {
        "API", "Database", "Redis", "WebSocket"
    }
    assert response.brokers[0].broker_name == "Zerodha"
    assert response.brokers[0].status == "UP"


def test_admin_system_health_stays_up_for_disabled_redis_and_disconnected_broker_in_paper_mode(monkeypatch):
    monkeypatch.setattr("app.services.admin_system_health_service.settings.REDIS_EVENT_BUS_ENABLED", False)
    monkeypatch.setattr("app.services.admin_system_health_service.settings.LIVE_TRADING_ENABLED", False)

    db = MagicMock()
    db.execute.return_value = MagicMock()
    broker = _broker(active=True)
    db.query.return_value.order_by.return_value.all.return_value = [broker]
    db.query.return_value.filter.return_value.first.return_value = None

    response = AdminSystemHealthService(
        db=db,
        websocket_manager=MagicMock(active_connections={}),
    ).check()

    redis = next(component for component in response.components if component.name == "Redis")
    assert redis.status == "DISABLED"
    assert response.brokers[0].status == "DOWN"
    assert response.overall_status == "UP"


def test_admin_system_health_degrades_when_enabled_redis_is_unavailable(monkeypatch):
    monkeypatch.setattr("app.services.admin_system_health_service.settings.REDIS_EVENT_BUS_ENABLED", True)
    monkeypatch.setattr("app.services.admin_system_health_service.settings.LIVE_TRADING_ENABLED", False)

    db = MagicMock()
    db.execute.return_value = MagicMock()
    db.query.return_value.order_by.return_value.all.return_value = []

    redis_transport = MagicMock()
    redis_transport.is_connected = False

    response = AdminSystemHealthService(
        db=db,
        redis_transport=redis_transport,
        websocket_manager=MagicMock(active_connections={}),
    ).check()

    redis = next(component for component in response.components if component.name == "Redis")
    assert redis.status == "DOWN"
    assert response.overall_status == "DEGRADED"


def test_admin_system_health_fails_when_database_is_unavailable(monkeypatch):
    monkeypatch.setattr("app.services.admin_system_health_service.settings.REDIS_EVENT_BUS_ENABLED", False)

    db = MagicMock()
    db.execute.side_effect = RuntimeError("database unavailable")
    db.query.return_value.order_by.return_value.all.return_value = []

    response = AdminSystemHealthService(db=db, websocket_manager=MagicMock(active_connections={})).check()

    database = next(component for component in response.components if component.name == "Database")
    redis = next(component for component in response.components if component.name == "Redis")

    assert database.status == "DOWN"
    assert redis.status == "DISABLED"
    assert response.overall_status == "DOWN"
