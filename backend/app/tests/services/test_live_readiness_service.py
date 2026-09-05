from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.services.live_readiness_service import LiveReadinessService
import importlib
settings_module = importlib.import_module("app.core.config.settings")


class FakeSessionService:
    def __init__(self, session=None):
        self.session = session

    def get_active_session(self, user_id, broker_id):
        return self.session


def make_db(risk=None, broker=None):
    class Result:
        def __init__(self, value=None): self.value = value
        def scalar_one_or_none(self): return self.value
        def first(self): return None

    class FakeDB:
        def __init__(self):
            self.risk = risk
            self.broker = broker
        def execute(self, stmt):
            text = str(stmt)
            if "SELECT 1" in text:
                return Result()
            if "order_idempotency" in text.lower():
                return Result()
            return Result(self.risk)
        def get(self, model, object_id):
            return self.broker
        def rollback(self): pass
    return FakeDB()


@pytest.mark.asyncio
async def test_readiness_never_executes_order_and_returns_conditional_when_live_disabled(monkeypatch):
    broker_id = uuid4()
    user_id = uuid4()
    broker = SimpleNamespace(id=broker_id, broker_type="zerodha", broker_name="Zerodha", is_active=True)
    risk = SimpleNamespace(
        max_order_quantity=100,
        max_order_notional=10000,
        max_position_quantity=500,
        max_exposure_notional=50000,
        max_orders_per_minute=10,
        daily_loss_limit=5000,
        kill_switch_active=False,
    )
    session = SimpleNamespace(expires_at=datetime.now(timezone.utc) + timedelta(hours=1))
    monkeypatch.setattr(settings_module.settings, "LIVE_TRADING_ENABLED", False)
    monkeypatch.setattr(settings_module.settings, "DEBUG", False)
    monkeypatch.setattr(settings_module.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings_module.settings, "STRATEGY_SCHEDULER_ENABLED", False)
    monkeypatch.setattr(settings_module.settings, "BROKER_RECONCILIATION_ENABLED", True)
    monkeypatch.setattr(settings_module.settings, "AUDIT_LOG_ENABLED", True)
    monkeypatch.setattr(settings_module.settings, "REDIS_EVENT_BUS_ENABLED", False)

    service = LiveReadinessService(make_db(risk=risk, broker=broker), FakeSessionService(session))
    result = await service.verify(user_id, broker_id)

    assert result.order_execution_attempted is False
    assert result.verdict == "CONDITIONAL"
    assert any(c.name == "live_configuration" and c.status == "WARN" for c in result.checks)
    assert any(c.name == "broker_session" and c.status == "PASS" for c in result.checks)


@pytest.mark.asyncio
async def test_readiness_blocks_active_kill_switch(monkeypatch):
    broker_id = uuid4()
    user_id = uuid4()
    broker = SimpleNamespace(id=broker_id, broker_type="zerodha", broker_name="Zerodha", is_active=True)
    risk = SimpleNamespace(
        max_order_quantity=100,
        max_order_notional=10000,
        max_position_quantity=500,
        max_exposure_notional=50000,
        max_orders_per_minute=10,
        daily_loss_limit=5000,
        kill_switch_active=True,
    )
    monkeypatch.setattr(settings_module.settings, "LIVE_TRADING_ENABLED", True)
    monkeypatch.setattr(settings_module.settings, "DEBUG", False)
    monkeypatch.setattr(settings_module.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings_module.settings, "STRATEGY_SCHEDULER_ENABLED", False)
    monkeypatch.setattr(settings_module.settings, "BROKER_RECONCILIATION_ENABLED", True)
    monkeypatch.setattr(settings_module.settings, "AUDIT_LOG_ENABLED", True)
    monkeypatch.setattr(settings_module.settings, "REDIS_EVENT_BUS_ENABLED", False)

    service = LiveReadinessService(make_db(risk=risk, broker=broker), FakeSessionService(SimpleNamespace(expires_at=datetime.now(timezone.utc) + timedelta(hours=1))))
    result = await service.verify(user_id, broker_id)

    assert result.verdict == "NOT_READY"
    assert any(c.name == "risk_limits" and c.status == "FAIL" for c in result.checks)
