import uuid
from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.schemas.paper_order import PaperOrderCreateRequest
from app.services.paper_order_service import PaperOrderService


class FakeSafety:
    def validate_mode(self, mode):
        assert mode == "PAPER"
        return "PAPER"

    def validate_paper_execution(self):
        return None

    def validate_order(self, **kwargs):
        assert kwargs["execution_mode"] == "PAPER"
        assert kwargs["request"].side in {"BUY", "SELL"}


class FakePaperRepo:
    def __init__(self):
        self.portfolio = SimpleNamespace(id=uuid.uuid4())

    def get_or_create_default_portfolio(self, **kwargs):
        return self.portfolio


class FakeAccounting:
    def get_risk_snapshot(self, **kwargs):
        return [], Decimal("0")

    def record_fill(self, **kwargs):
        return SimpleNamespace(id=uuid.uuid4())


class FakeExecutionRepo:
    def __init__(self):
        self.execution = SimpleNamespace(
            id=uuid.uuid4(),
            external_execution_id="PAPER-test123",
            execution_mode="PAPER",
            symbol="INFY",
            side="BUY",
            quantity=Decimal("2"),
            price=Decimal("1500"),
            executed_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
            broker_id=None,
            strategy_instance_id=None,
            signal_id=None,
        )

    def get_by_external_id(self, mode, broker_id, external_id):
        assert mode == "PAPER"
        return self.execution


class FakeEvents:
    def emit(self, *args, **kwargs):
        return None


def test_paper_order_service_never_routes_to_broker():
    service = PaperOrderService(
        paper_repository=FakePaperRepo(),
        execution_repository=FakeExecutionRepo(),
        accounting_service=FakeAccounting(),
        risk_engine=object(),
        safety_service=FakeSafety(),
        trading_events=FakeEvents(),
    )

    response = service.create_order(
        user_id=uuid.uuid4(),
        payload=PaperOrderCreateRequest(
            symbol="INFY",
            side="BUY",
            quantity=Decimal("2"),
            order_type="MARKET",
            price=Decimal("1500"),
        ),
    )

    assert response.execution_mode == "PAPER"
    assert response.status == "FILLED"
    assert response.symbol == "INFY"
