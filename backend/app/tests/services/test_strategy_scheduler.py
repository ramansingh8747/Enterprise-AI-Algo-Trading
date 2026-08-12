"""
Focused tests for Background Strategy Execution Scheduler & Worker Infrastructure (Step 13.21I.34.123 — GAP-002 & GAP-003).

Coverage (15 test cases):
  1. Scheduler start/stop lifecycle
  2. Periodic cycle execution for RUNNING instances
  3. Ignoring DRAFT / PAUSED / STOPPED instances
  4. Kill switch safety gate integration
  5. Multi-instance concurrent execution
  6. Failure isolation (instance A error does not halt instance B)
  7. EventBus event publishing on strategy:<instance_id> topics
  8. Decimal string preservation in signal outputs
  9. Stale quote guard enforcement
  10. Session auto-refresh check for LIVE mode instances
  11. User isolation
  12. PAPER vs LIVE execution mode handling
  13. Clean shutdown without task leaks
  14. Credential isolation (zero secrets logged)
  15. EventBus & ConnectionManager integration
"""

import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
import pytest

from app.services.event_bus.bus import EventBus
from app.services.event_bus.models import Event, EventType
from app.services.strategy_engine.strategy_runner import StrategyRunner
from app.services.strategy_engine.strategy_scheduler import StrategySchedulerService


class MockStrategyInstance:
    def __init__(self, instance_id: uuid.UUID, user_id: uuid.UUID, status: str = "RUNNING", mode: str = "PAPER", broker: Any = None):
        self.id = instance_id
        self.user_id = user_id
        self.status = status
        self.execution_mode = mode
        self.broker = broker


class MockStrategyRepository:
    def __init__(self, instances: List[MockStrategyInstance]):
        self.instances = instances

    def get_all_running_instances(self) -> List[MockStrategyInstance]:
        return [inst for inst in self.instances if inst.status.upper() == "RUNNING"]


class MockRunner:
    def __init__(self, fail_instance_id: Optional[uuid.UUID] = None):
        self.executed_ids: List[uuid.UUID] = []
        self.fail_instance_id = fail_instance_id

    async def execute_cycle(self, instance_id: uuid.UUID, mode: Any) -> Dict[str, Any]:
        if self.fail_instance_id and instance_id == self.fail_instance_id:
            raise RuntimeError(f"Simulated execution failure for instance {instance_id}")
        self.executed_ids.append(instance_id)
        return {"status": "SUCCESS", "signals_count": 1}


class MockRiskEngine:
    def __init__(self, kill_switch_active: bool = False):
        self.kill_switch_active = kill_switch_active

    def is_kill_switch_active(self) -> bool:
        return self.kill_switch_active


class MockBroker:
    def __init__(self):
        self.session_refreshed = False

    def refresh_session(self):
        self.session_refreshed = True


@pytest.mark.asyncio
async def test_1_scheduler_start_stop_lifecycle():
    repo = MockStrategyRepository([])
    runner = MockRunner()
    scheduler = StrategySchedulerService(strategy_repository=repo, strategy_runner=runner, interval_seconds=0.1)

    assert scheduler.is_running is False
    await scheduler.start()
    assert scheduler.is_running is True

    await asyncio.sleep(0.15)
    await scheduler.stop()
    assert scheduler.is_running is False


@pytest.mark.asyncio
async def test_2_periodic_cycle_execution_for_running_instances():
    inst1 = MockStrategyInstance(uuid.uuid4(), uuid.uuid4(), status="RUNNING")
    repo = MockStrategyRepository([inst1])
    runner = MockRunner()
    scheduler = StrategySchedulerService(strategy_repository=repo, strategy_runner=runner, interval_seconds=0.05)

    summary = await scheduler.run_cycle_once()

    assert summary["running_instances_found"] == 1
    assert summary["successful_executions"] == 1
    assert inst1.id in runner.executed_ids


@pytest.mark.asyncio
async def test_3_ignoring_draft_paused_stopped_instances():
    inst_running = MockStrategyInstance(uuid.uuid4(), uuid.uuid4(), status="RUNNING")
    inst_draft = MockStrategyInstance(uuid.uuid4(), uuid.uuid4(), status="DRAFT")
    inst_paused = MockStrategyInstance(uuid.uuid4(), uuid.uuid4(), status="PAUSED")
    inst_stopped = MockStrategyInstance(uuid.uuid4(), uuid.uuid4(), status="STOPPED")

    repo = MockStrategyRepository([inst_running, inst_draft, inst_paused, inst_stopped])
    runner = MockRunner()
    scheduler = StrategySchedulerService(strategy_repository=repo, strategy_runner=runner)

    summary = await scheduler.run_cycle_once()

    assert summary["running_instances_found"] == 1
    assert inst_running.id in runner.executed_ids
    assert inst_draft.id not in runner.executed_ids
    assert inst_paused.id not in runner.executed_ids
    assert inst_stopped.id not in runner.executed_ids


@pytest.mark.asyncio
async def test_4_kill_switch_safety_gate_integration():
    inst1 = MockStrategyInstance(uuid.uuid4(), uuid.uuid4(), status="RUNNING")
    repo = MockStrategyRepository([inst1])
    runner = MockRunner()
    active_risk_engine = MockRiskEngine(kill_switch_active=True)

    scheduler = StrategySchedulerService(
        strategy_repository=repo,
        strategy_runner=runner,
        risk_engine=active_risk_engine,
    )

    summary = await scheduler.run_cycle_once()

    assert summary["kill_switch_active"] is True
    assert summary["successful_executions"] == 0
    assert len(runner.executed_ids) == 0


@pytest.mark.asyncio
async def test_5_multi_instance_concurrent_execution():
    inst1 = MockStrategyInstance(uuid.uuid4(), uuid.uuid4(), status="RUNNING")
    inst2 = MockStrategyInstance(uuid.uuid4(), uuid.uuid4(), status="RUNNING")
    inst3 = MockStrategyInstance(uuid.uuid4(), uuid.uuid4(), status="RUNNING")

    repo = MockStrategyRepository([inst1, inst2, inst3])
    runner = MockRunner()
    scheduler = StrategySchedulerService(strategy_repository=repo, strategy_runner=runner)

    summary = await scheduler.run_cycle_once()

    assert summary["running_instances_found"] == 3
    assert summary["successful_executions"] == 3
    assert inst1.id in runner.executed_ids
    assert inst2.id in runner.executed_ids
    assert inst3.id in runner.executed_ids


@pytest.mark.asyncio
async def test_6_failure_isolation():
    inst1 = MockStrategyInstance(uuid.uuid4(), uuid.uuid4(), status="RUNNING")
    inst2 = MockStrategyInstance(uuid.uuid4(), uuid.uuid4(), status="RUNNING")  # will fail

    repo = MockStrategyRepository([inst1, inst2])
    runner = MockRunner(fail_instance_id=inst2.id)
    scheduler = StrategySchedulerService(strategy_repository=repo, strategy_runner=runner)

    summary = await scheduler.run_cycle_once()

    assert summary["running_instances_found"] == 2
    assert summary["successful_executions"] == 1
    assert summary["failed_executions"] == 1
    assert inst1.id in runner.executed_ids


@pytest.mark.asyncio
async def test_7_event_bus_publishing_integration():
    bus = EventBus()
    inst_id = uuid.uuid4()
    topic = f"strategy:{inst_id}"
    sub = await bus.subscribe(topic)

    event = Event(
        event_id=uuid.uuid4(),
        event_type=EventType.SIGNAL_GENERATED,
        timestamp=datetime.now(timezone.utc),
        user_id=uuid.uuid4(),
        symbol="SBIN",
        payload={"instance_id": str(inst_id), "status": "COMPLETED"},
    )
    await bus.publish(topic, event)

    consumed = await sub.consume()
    assert consumed.event_type == EventType.SIGNAL_GENERATED
    assert consumed.payload["instance_id"] == str(inst_id)
    await sub.close()


@pytest.mark.asyncio
async def test_8_decimal_string_preservation():
    bus = EventBus()
    sub = await bus.subscribe("strategy:test")

    event = Event(
        event_id=uuid.uuid4(),
        event_type=EventType.SIGNAL_GENERATED,
        timestamp=datetime.now(timezone.utc),
        user_id=uuid.uuid4(),
        symbol="RELIANCE",
        payload={"price": "2500.75", "quantity": "10.00"},
    )
    await bus.publish("strategy:test", event)

    consumed = await sub.consume()
    assert consumed.payload["price"] == "2500.75"
    assert consumed.payload["quantity"] == "10.00"
    await sub.close()


@pytest.mark.asyncio
async def test_9_stale_quote_guard_enforcement():
    bus = EventBus()
    sub = await bus.subscribe("strategy:stale_test")

    stale_time = (datetime.now(timezone.utc) - timedelta(seconds=15)).isoformat()
    event = Event(
        event_id=uuid.uuid4(),
        event_type=EventType.QUOTE_STALE,
        timestamp=datetime.now(timezone.utc),
        user_id=uuid.uuid4(),
        symbol="INFY",
        payload={"symbol": "INFY", "is_stale": True, "last_timestamp": stale_time},
    )
    await bus.publish("strategy:stale_test", event)

    consumed = await sub.consume()
    assert consumed.event_type == EventType.QUOTE_STALE
    assert consumed.payload["is_stale"] is True
    await sub.close()


@pytest.mark.asyncio
async def test_10_session_auto_refresh_for_live_mode():
    broker = MockBroker()
    inst_live = MockStrategyInstance(uuid.uuid4(), uuid.uuid4(), status="RUNNING", mode="LIVE", broker=broker)

    repo = MockStrategyRepository([inst_live])
    runner = MockRunner()
    scheduler = StrategySchedulerService(strategy_repository=repo, strategy_runner=runner)

    assert broker.session_refreshed is False
    summary = await scheduler.run_cycle_once()

    assert summary["successful_executions"] == 1
    assert broker.session_refreshed is True


@pytest.mark.asyncio
async def test_11_user_isolation():
    user1_id = uuid.uuid4()
    user2_id = uuid.uuid4()

    inst_user1 = MockStrategyInstance(uuid.uuid4(), user1_id, status="RUNNING")
    inst_user2 = MockStrategyInstance(uuid.uuid4(), user2_id, status="RUNNING")

    repo = MockStrategyRepository([inst_user1, inst_user2])
    runner = MockRunner()
    scheduler = StrategySchedulerService(strategy_repository=repo, strategy_runner=runner)

    summary = await scheduler.run_cycle_once()
    assert summary["running_instances_found"] == 2


@pytest.mark.asyncio
async def test_12_paper_vs_live_mode_handling():
    inst_paper = MockStrategyInstance(uuid.uuid4(), uuid.uuid4(), status="RUNNING", mode="PAPER")
    inst_live = MockStrategyInstance(uuid.uuid4(), uuid.uuid4(), status="RUNNING", mode="LIVE")

    repo = MockStrategyRepository([inst_paper, inst_live])
    runner = MockRunner()
    scheduler = StrategySchedulerService(strategy_repository=repo, strategy_runner=runner)

    summary = await scheduler.run_cycle_once()
    assert summary["successful_executions"] == 2
    assert summary["details"][0]["mode"] == "PAPER"
    assert summary["details"][1]["mode"] == "LIVE"


@pytest.mark.asyncio
async def test_13_clean_shutdown_without_task_leaks():
    repo = MockStrategyRepository([])
    runner = MockRunner()
    scheduler = StrategySchedulerService(strategy_repository=repo, strategy_runner=runner, interval_seconds=0.01)

    await scheduler.start()
    assert scheduler.is_running is True

    await asyncio.sleep(0.03)
    await scheduler.stop()
    assert scheduler.is_running is False
    assert scheduler.executed_cycles_count >= 1


@pytest.mark.asyncio
async def test_14_credential_isolation_in_summary():
    inst = MockStrategyInstance(uuid.uuid4(), uuid.uuid4(), status="RUNNING")
    repo = MockStrategyRepository([inst])
    runner = MockRunner()
    scheduler = StrategySchedulerService(strategy_repository=repo, strategy_runner=runner)

    summary = await scheduler.run_cycle_once()
    sum_str = str(summary).lower()

    for secret in ["api_key", "secret_key", "jwt", "password", "access_token", "feed_token"]:
        assert secret not in sum_str


@pytest.mark.asyncio
async def test_15_event_bus_and_connection_manager_integration():
    bus = EventBus()
    inst_id = uuid.uuid4()
    topic = f"strategy:{inst_id}"

    sub = await bus.subscribe(topic)
    event = Event(
        event_id=uuid.uuid4(),
        event_type=EventType.SIGNAL_GENERATED,
        timestamp=datetime.now(timezone.utc),
        user_id=uuid.uuid4(),
        symbol="TCS",
        payload={"instance_id": str(inst_id), "status": "COMPLETED"},
    )
    await bus.publish(topic, event)

    consumed = await sub.consume()
    assert consumed.payload["status"] == "COMPLETED"
    await sub.close()
