from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.services.live_activation_service import LiveActivationService


class FakeSessionService:
    def __init__(self, session):
        self.session = session

    def get_active_session(self, user_id, broker_id):
        return self.session


class FakeDB:
    def __init__(self, broker, risk):
        self.broker = broker
        self.risk = risk

    def execute(self, stmt):
        class Result:
            def __init__(self, value=None): self.value = value
            def scalar_one_or_none(self): return self.value
            def first(self): return None
        text = str(stmt)
        if "SELECT 1" in text or "order_idempotency" in text.lower():
            return Result()
        return Result(self.risk)

    def get(self, model, object_id):
        return self.broker

    def rollback(self):
        pass


@pytest.mark.asyncio
async def test_activation_requires_confirmation(monkeypatch):
    import importlib
    settings_module = importlib.import_module("app.core.config.settings")
    monkeypatch.setattr(settings_module.settings, "LIVE_TRADING_ENABLED", True)
    monkeypatch.setattr(settings_module.settings, "DEBUG", False)
    monkeypatch.setattr(settings_module.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings_module.settings, "STRATEGY_SCHEDULER_ENABLED", False)
    monkeypatch.setattr(settings_module.settings, "BROKER_RECONCILIATION_ENABLED", True)
    monkeypatch.setattr(settings_module.settings, "AUDIT_LOG_ENABLED", True)
    monkeypatch.setattr(settings_module.settings, "REDIS_EVENT_BUS_ENABLED", False)

    broker_id = uuid4()
    broker = SimpleNamespace(id=broker_id, broker_type="zerodha", broker_name="Zerodha", is_active=True)
    risk = SimpleNamespace(max_order_quantity=100, max_order_notional=10000, max_position_quantity=500,
                           max_exposure_notional=50000, max_orders_per_minute=10, daily_loss_limit=5000,
                           kill_switch_active=False)
    session = SimpleNamespace(expires_at=datetime.now(timezone.utc) + timedelta(hours=1))
    service = LiveActivationService(FakeDB(broker, risk), FakeSessionService(session))

    result = await service.authorize(uuid4(), broker_id, confirmed=False)
    assert result.verdict == "ACTIVATION_BLOCKED"
    assert result.order_execution_attempted is False
