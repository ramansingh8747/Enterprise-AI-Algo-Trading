import asyncio
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock

from app.brokers.base.broker_types import BrokerQuote
from app.database.models.strategy import StrategyInstance, StrategySignal
from app.services.event_bus.bus import EventBus
from app.services.strategy_engine.base_strategy import DeterministicMomentumStrategy
from app.services.strategy_engine.strategy_runner import StrategyRunner
from app.services.strategy_engine.strategy_scheduler import StrategySchedulerService


class FakeRepository:
    def __init__(self, instance, signal):
        self.instance = instance
        self.signal = signal
        self.db = MagicMock()

    def get_all_running_instances(self):
        return [self.instance]

    def get_definition_for_user(self, definition_id, user_id):
        return SimpleNamespace(id=definition_id, config_json='{"symbol":"INFY","exchange":"NSE","entry_condition":"ALWAYS_TRUE","auto_pilot":true}')

    def get_instance_for_user(self, instance_id, user_id):
        return self.instance if instance_id == self.instance.id and user_id == self.instance.user_id else None

    def create_signal_if_not_exists(self, **kwargs):
        self.signal.id = uuid.uuid4()
        for key, value in kwargs.items():
            if hasattr(self.signal, key):
                setattr(self.signal, key, value)
        return self.signal, True

    def mark_execution(self, signal_id, order_id):
        pass

    def get_signal_by_id(self, signal_id, user_id=None):
        return self.signal

    def update_signal_status(self, *args, **kwargs):
        pass


class FakeBrokerService:
    def __init__(self, quote):
        self.quote = quote
        self.place_order_calls = 0

    def get_quotes(self, user_id, broker_id, symbols):
        return [self.quote]


class FakePaperAccounting:
    def __init__(self):
        self.fills = []

    def record_fill(self, **kwargs):
        self.fills.append(kwargs)
        return SimpleNamespace(symbol=kwargs["symbol"], quantity=Decimal(str(kwargs["quantity"])))


def test_full_controlled_paper_scheduler_to_execution_boundary():
    user_id = uuid.uuid4()
    instance_id = uuid.uuid4()
    broker_id = uuid.uuid4()
    definition_id = uuid.uuid4()
    instance = StrategyInstance(
        id=instance_id, user_id=user_id, broker_id=broker_id,
        strategy_definition_id=definition_id, execution_mode="PAPER", status="RUNNING"
    )
    signal = StrategySignal(
        strategy_instance_id=instance_id, user_id=user_id, broker_id=broker_id,
        symbol="INFY", side="BUY", quantity=Decimal("10"), order_type="MARKET",
        signal_fingerprint="", status="PROPOSED"
    )
    repo = FakeRepository(instance, signal)
    paper = FakePaperAccounting()
    live_broker = MagicMock()
    event_bus = EventBus()
    quote = BrokerQuote(
        symbol="NSE:INFY", bid=Decimal("1499"), ask=Decimal("1501"),
        last_price=Decimal("1500"), change_percent=Decimal("2.0")
    )
    market_provider = MagicMock()
    market_provider.process_and_publish_quote.return_value = SimpleNamespace(
        event_type=SimpleNamespace(value="quote.updated"),
        payload={"symbol":"INFY", "last_price":"1500", "change_percent":"2.0", "timestamp":datetime.now(timezone.utc).isoformat()}
    )
    broker_service = FakeBrokerService(quote)
    runner = StrategyRunner(
        repository=repo, broker_order_service=live_broker,
        paper_accounting_service=paper, event_publisher=None,
        max_data_age_seconds=10
    )
    scheduler = StrategySchedulerService(
        strategy_repository=repo, strategy_runner=runner,
        broker_service=broker_service, market_data_provider=market_provider, interval_seconds=1
    )

    summary = asyncio.run(scheduler.run_cycle_once())

    assert summary["running_instances_found"] == 1
    assert summary["successful_executions"] == 1
    assert summary["failed_executions"] == 0
    assert len(paper.fills) == 1
    assert paper.fills[0]["execution_mode"] == "PAPER"
    assert paper.fills[0]["symbol"] == "INFY"
    live_broker.place_order.assert_not_called()
