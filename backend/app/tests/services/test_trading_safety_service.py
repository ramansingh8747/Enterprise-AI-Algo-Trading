from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.brokers.base.broker_types import BrokerOrderRequest
from app.exceptions.broker_exceptions import BrokerSessionExpiredException
from app.exceptions.risk_exceptions import TradingHaltedException
from app.services.trading_safety_service import TradingSafetyService


def _request():
    return BrokerOrderRequest(
        symbol="INFY",
        exchange="NSE",
        quantity=Decimal("10"),
        side="BUY",
        order_type="LIMIT",
        product="CNC",
        variety="regular",
        price=Decimal("1500"),
    )


def test_live_execution_fails_closed_when_disabled(monkeypatch):
    monkeypatch.setattr("app.services.trading_safety_service.settings.LIVE_TRADING_ENABLED", False)
    risk = MagicMock()
    sessions = MagicMock()
    service = TradingSafetyService(risk, sessions)

    with pytest.raises(TradingHaltedException):
        service.validate_live_execution(uuid4(), uuid4())

    sessions.get_active_session.assert_not_called()
    risk.validate_order.assert_not_called()


def test_live_execution_requires_active_session(monkeypatch):
    monkeypatch.setattr("app.services.trading_safety_service.settings.LIVE_TRADING_ENABLED", True)
    risk = MagicMock()
    sessions = MagicMock()
    sessions.get_active_session.return_value = None
    service = TradingSafetyService(risk, sessions)

    with pytest.raises(BrokerSessionExpiredException):
        service.validate_order(uuid4(), uuid4(), _request(), "LIVE")

    risk.validate_order.assert_not_called()


def test_live_execution_runs_risk_after_session_gate(monkeypatch):
    monkeypatch.setattr("app.services.trading_safety_service.settings.LIVE_TRADING_ENABLED", True)
    risk = MagicMock()
    sessions = MagicMock()
    sessions.get_active_session.return_value = MagicMock(
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10)
    )
    service = TradingSafetyService(risk, sessions)

    user_id, broker_id = uuid4(), uuid4()
    service.validate_order(
        user_id,
        broker_id,
        _request(),
        "LIVE",
        current_positions=[],
        current_exposure_notional=Decimal("0"),
    )

    sessions.get_active_session.assert_called_once_with(user_id, broker_id)
    risk.validate_order.assert_called_once()


def test_paper_execution_never_requires_broker_session():
    risk = MagicMock()
    sessions = MagicMock()
    service = TradingSafetyService(risk, sessions)

    service.validate_order(
        uuid4(), uuid4(), _request(), "PAPER", current_positions=[], current_exposure_notional=Decimal("0")
    )

    sessions.get_active_session.assert_not_called()
    risk.validate_order.assert_called_once()
