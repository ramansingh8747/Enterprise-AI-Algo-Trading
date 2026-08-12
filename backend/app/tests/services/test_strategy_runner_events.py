"""
Focused tests for StrategyRunner Event Publishing (Step 13.21I.34.117).

Tests:
  1. started event published
  2. paused event published
  3. resumed event published
  4. stopped event published
  5. failed event published
  6. signal.generated event published
  7. signal.executed event published (PAPER mode)
  8. signal.executed event published (LIVE mode)
  9. signal.rejected event published (LIVE mode failure)
  10. correct user_id in event
  11. correct strategy_instance_id in event
  12. PAPER/LIVE metadata correctness
  13. credential isolation in event payload (zero secrets exposed)
  14. event publication failure does NOT break strategy execution or lifecycle
  15. event ordering for lifecycle transitions
  16. no event published for invalid/unsuccessful state transition
  17. no duplicate events emitted per lifecycle action
"""

import asyncio
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.models.user import User, UserRole
from app.database.models.broker import Broker
from app.database.models.strategy import StrategyDefinition, StrategyInstance, StrategySignal
from app.database.repositories.strategy_repository import StrategyRepository
from app.services.strategy_engine.strategy_runner import StrategyRunner
from app.services.event_bus.bus import EventBus
from app.services.event_bus.models import Event, EventType
from app.services.event_bus.topics import Topic
from app.brokers.base.broker_types import BrokerOrderRequest, BrokerOrder
from app.exceptions.strategy_exceptions import InvalidLifecycleTransitionException


# ---------------------------------------------------------------------------
# Test database setup
# ---------------------------------------------------------------------------

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def repo(db_session):
    return StrategyRepository(db_session)


@pytest.fixture
def user_a(db_session):
    u = User(
        id=uuid.uuid4(),
        email="usera@enterprise.ai",
        username="usera",
        password_hash="hash",
        full_name="User A",
        role=UserRole.TRADER,
        is_active=True,
    )
    db_session.add(u)
    db_session.commit()
    return u


@pytest.fixture
def user_b(db_session):
    u = User(
        id=uuid.uuid4(),
        email="userb@enterprise.ai",
        username="userb",
        password_hash="hash",
        full_name="User B",
        role=UserRole.TRADER,
        is_active=True,
    )
    db_session.add(u)
    db_session.commit()
    return u


@pytest.fixture
def broker_a(db_session):
    b = Broker(
        id=uuid.uuid4(),
        broker_name="Test Broker A",
        broker_type="ZERODHA",
        api_key="encrypted_key",
        api_secret="encrypted_secret",
        client_id="test_client",
        is_active=True,
    )
    db_session.add(b)
    db_session.commit()
    return b


@pytest.fixture
def definition_a(db_session, user_a):
    d = StrategyDefinition(
        id=uuid.uuid4(),
        user_id=user_a.id,
        name="Event Test Strategy",
        strategy_type="DETERMINISTIC_MOMENTUM",
        is_active=True,
    )
    db_session.add(d)
    db_session.commit()
    return d


@pytest.fixture
def instance_a(db_session, definition_a, user_a, broker_a):
    inst = StrategyInstance(
        id=uuid.uuid4(),
        strategy_definition_id=definition_a.id,
        user_id=user_a.id,
        broker_id=broker_a.id,
        execution_mode="PAPER",
        status="DRAFT",
    )
    db_session.add(inst)
    db_session.commit()
    return inst


# ---------------------------------------------------------------------------
# Mock Event Publisher for tracking emitted events
# ---------------------------------------------------------------------------

class CapturingEventPublisher:
    def __init__(self, fail_mode: bool = False):
        self.published_events: List[tuple[str, Event]] = []
        self.fail_mode = fail_mode

    async def publish(self, topic: str, event: Event) -> None:
        if self.fail_mode:
            raise RuntimeError("EventBus connection failure simulation!")
        self.published_events.append((topic, event))


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_instance_started_event_published(repo, instance_a, user_a):
    publisher = CapturingEventPublisher()
    runner = StrategyRunner(repository=repo, event_publisher=publisher)

    updated = runner.start_instance(instance_a.id, user_a.id)
    await asyncio.sleep(0.01)

    assert updated.status == "RUNNING"
    assert len(publisher.published_events) == 1

    topic, event = publisher.published_events[0]
    assert topic == f"strategy:{instance_a.id}"
    assert event.event_type == EventType.INSTANCE_STARTED
    assert event.user_id == user_a.id
    assert event.strategy_instance_id == instance_a.id
    assert event.execution_mode == "PAPER"
    assert event.payload["status"] == "RUNNING"


@pytest.mark.asyncio
async def test_instance_paused_event_published(repo, instance_a, user_a):
    publisher = CapturingEventPublisher()
    runner = StrategyRunner(repository=repo, event_publisher=publisher)

    runner.start_instance(instance_a.id, user_a.id)
    await asyncio.sleep(0.01)
    publisher.published_events.clear()

    paused = runner.pause_instance(instance_a.id, user_a.id)
    await asyncio.sleep(0.01)

    assert paused.status == "PAUSED"
    assert len(publisher.published_events) == 1

    topic, event = publisher.published_events[0]
    assert topic == f"strategy:{instance_a.id}"
    assert event.event_type == EventType.INSTANCE_PAUSED
    assert event.user_id == user_a.id
    assert event.payload["status"] == "PAUSED"


@pytest.mark.asyncio
async def test_instance_resumed_event_published(repo, instance_a, user_a):
    publisher = CapturingEventPublisher()
    runner = StrategyRunner(repository=repo, event_publisher=publisher)

    runner.start_instance(instance_a.id, user_a.id)
    runner.pause_instance(instance_a.id, user_a.id)
    await asyncio.sleep(0.01)
    publisher.published_events.clear()

    resumed = runner.resume_instance(instance_a.id, user_a.id)
    await asyncio.sleep(0.01)

    assert resumed.status == "RUNNING"
    assert len(publisher.published_events) == 1

    topic, event = publisher.published_events[0]
    assert event.event_type == EventType.INSTANCE_RESUMED
    assert event.payload["status"] == "RUNNING"


@pytest.mark.asyncio
async def test_instance_stopped_event_published(repo, instance_a, user_a):
    publisher = CapturingEventPublisher()
    runner = StrategyRunner(repository=repo, event_publisher=publisher)

    runner.start_instance(instance_a.id, user_a.id)
    await asyncio.sleep(0.01)
    publisher.published_events.clear()

    stopped = runner.stop_instance(instance_a.id, user_a.id)
    await asyncio.sleep(0.01)

    assert stopped.status == "STOPPED"
    assert len(publisher.published_events) == 1

    topic, event = publisher.published_events[0]
    assert event.event_type == EventType.INSTANCE_STOPPED
    assert event.payload["status"] == "STOPPED"


@pytest.mark.asyncio
async def test_instance_failed_event_published(repo, instance_a, user_a):
    publisher = CapturingEventPublisher()
    runner = StrategyRunner(repository=repo, event_publisher=publisher)

    runner.start_instance(instance_a.id, user_a.id)
    await asyncio.sleep(0.01)
    publisher.published_events.clear()

    failed = runner.mark_instance_failed(instance_a.id, user_a.id, "Fatal risk violation")
    await asyncio.sleep(0.01)

    assert failed.status == "FAILED"
    assert failed.error_message == "Fatal risk violation"
    assert len(publisher.published_events) == 1

    topic, event = publisher.published_events[0]
    assert event.event_type == EventType.INSTANCE_FAILED
    assert event.payload["status"] == "FAILED"
    assert event.payload["error_message"] == "Fatal risk violation"


@pytest.mark.asyncio
async def test_signal_generated_and_executed_paper_events(repo, instance_a, user_a):
    publisher = CapturingEventPublisher()
    runner = StrategyRunner(repository=repo, event_publisher=publisher)

    runner.start_instance(instance_a.id, user_a.id)
    await asyncio.sleep(0.01)
    publisher.published_events.clear()

    now_iso = datetime.now(timezone.utc).isoformat()
    market_data = {
        "symbol": "RELIANCE",
        "price": 2500.0,
        "change_percent": 2.5,  # Bullish breakout -> generates BUY signal
        "timestamp": now_iso,
    }

    order = runner.execute_cycle(instance_a.id, user_a.id, market_data)
    await asyncio.sleep(0.01)

    assert order is not None
    assert order.status == "COMPLETE"

    # Should have 2 events: signal.generated and signal.executed
    assert len(publisher.published_events) == 2
    types = [ev[1].event_type for ev in publisher.published_events]
    assert types == [EventType.SIGNAL_GENERATED, EventType.SIGNAL_EXECUTED]

    gen_event = publisher.published_events[0][1]
    assert gen_event.symbol == "RELIANCE"
    assert gen_event.payload["side"] == "BUY"
    assert gen_event.payload["quantity"] == "10"

    exec_event = publisher.published_events[1][1]
    assert exec_event.execution_mode == "PAPER"
    assert exec_event.payload["status"] == "COMPLETE"


class MockLiveBrokerOrderService:
    def __init__(self, should_fail: bool = False):
        self.should_fail = should_fail

    def place_order(self, user_id, broker_id, request, idempotency_key):
        if self.should_fail:
            raise RuntimeError("RiskEngine rejection: Order exceeds max notional limit.")
        return BrokerOrder(
            order_id="LIVE-ORDER-12345",
            symbol=request.symbol,
            side=request.side,
            quantity=request.quantity,
            status="OPEN",
        )


@pytest.mark.asyncio
async def test_signal_executed_live_event(repo, instance_a, user_a, db_session):
    instance_a.execution_mode = "LIVE"
    db_session.commit()

    publisher = CapturingEventPublisher()
    mock_broker_service = MockLiveBrokerOrderService(should_fail=False)
    runner = StrategyRunner(
        repository=repo,
        broker_order_service=mock_broker_service,
        event_publisher=publisher,
    )

    runner.start_instance(instance_a.id, user_a.id)
    await asyncio.sleep(0.01)
    publisher.published_events.clear()

    now_iso = datetime.now(timezone.utc).isoformat()
    market_data = {
        "symbol": "TCS",
        "price": 3500.0,
        "change_percent": 1.5,
        "timestamp": now_iso,
    }

    order = runner.execute_cycle(instance_a.id, user_a.id, market_data)
    await asyncio.sleep(0.01)

    assert order is not None
    assert order.order_id == "LIVE-ORDER-12345"

    assert len(publisher.published_events) == 2
    exec_event = publisher.published_events[1][1]
    assert exec_event.event_type == EventType.SIGNAL_EXECUTED
    assert exec_event.execution_mode == "LIVE"
    assert exec_event.payload["order_id"] == "LIVE-ORDER-12345"


@pytest.mark.asyncio
async def test_signal_rejected_live_event(repo, instance_a, user_a, db_session):
    instance_a.execution_mode = "LIVE"
    db_session.commit()

    publisher = CapturingEventPublisher()
    mock_broker_service = MockLiveBrokerOrderService(should_fail=True)
    runner = StrategyRunner(
        repository=repo,
        broker_order_service=mock_broker_service,
        event_publisher=publisher,
    )

    runner.start_instance(instance_a.id, user_a.id)
    await asyncio.sleep(0.01)
    publisher.published_events.clear()

    now_iso = datetime.now(timezone.utc).isoformat()
    market_data = {
        "symbol": "INFY",
        "price": 1500.0,
        "change_percent": 2.0,
        "timestamp": now_iso,
    }

    with pytest.raises(RuntimeError) as exc_info:
        runner.execute_cycle(instance_a.id, user_a.id, market_data)

    await asyncio.sleep(0.01)
    assert "RiskEngine rejection" in str(exc_info.value)

    assert len(publisher.published_events) == 2
    rej_event = publisher.published_events[1][1]
    assert rej_event.event_type == EventType.SIGNAL_REJECTED
    assert rej_event.execution_mode == "LIVE"
    assert "RiskEngine rejection" in rej_event.payload["reason"]


@pytest.mark.asyncio
async def test_user_id_and_instance_id_correctness(repo, instance_a, user_a):
    publisher = CapturingEventPublisher()
    runner = StrategyRunner(repository=repo, event_publisher=publisher)

    runner.start_instance(instance_a.id, user_a.id)
    await asyncio.sleep(0.01)

    _, event = publisher.published_events[0]
    assert event.user_id == user_a.id
    assert event.strategy_instance_id == instance_a.id


@pytest.mark.asyncio
async def test_credential_isolation_in_events(repo, instance_a, user_a):
    publisher = CapturingEventPublisher()
    runner = StrategyRunner(repository=repo, event_publisher=publisher)

    runner.start_instance(instance_a.id, user_a.id)
    await asyncio.sleep(0.01)

    _, event = publisher.published_events[0]
    event_json = event.model_dump_json().lower()

    for secret_key in ["api_key", "api_secret", "access_token", "password", "authorization", "jwt"]:
        assert secret_key not in event_json, f"Secret '{secret_key}' found in published event payload!"


@pytest.mark.asyncio
async def test_event_publication_failure_does_not_break_execution(repo, instance_a, user_a):
    # Publisher configured to fail on every publish call
    failing_publisher = CapturingEventPublisher(fail_mode=True)
    runner = StrategyRunner(repository=repo, event_publisher=failing_publisher)

    # State transition must still succeed even if event publisher raises RuntimeError
    updated = runner.start_instance(instance_a.id, user_a.id)
    await asyncio.sleep(0.01)
    assert updated.status == "RUNNING"

    now_iso = datetime.now(timezone.utc).isoformat()
    market_data = {
        "symbol": "RELIANCE",
        "price": 2500.0,
        "change_percent": 1.5,
        "timestamp": now_iso,
    }

    # execute_cycle must still complete and return paper order despite event publish failure
    order = runner.execute_cycle(instance_a.id, user_a.id, market_data)
    await asyncio.sleep(0.01)
    assert order is not None
    assert order.status == "COMPLETE"


@pytest.mark.asyncio
async def test_event_ordering_for_lifecycle_transitions(repo, instance_a, user_a):
    publisher = CapturingEventPublisher()
    runner = StrategyRunner(repository=repo, event_publisher=publisher)

    runner.start_instance(instance_a.id, user_a.id)
    runner.pause_instance(instance_a.id, user_a.id)
    runner.resume_instance(instance_a.id, user_a.id)
    runner.stop_instance(instance_a.id, user_a.id)
    await asyncio.sleep(0.01)

    event_types = [ev[1].event_type for ev in publisher.published_events]
    expected_order = [
        EventType.INSTANCE_STARTED,
        EventType.INSTANCE_PAUSED,
        EventType.INSTANCE_RESUMED,
        EventType.INSTANCE_STOPPED,
    ]
    assert event_types == expected_order


@pytest.mark.asyncio
async def test_no_event_published_for_invalid_transition(repo, instance_a, user_a):
    publisher = CapturingEventPublisher()
    runner = StrategyRunner(repository=repo, event_publisher=publisher)

    # Attempt DRAFT -> PAUSED (invalid)
    with pytest.raises(InvalidLifecycleTransitionException):
        runner.pause_instance(instance_a.id, user_a.id)

    await asyncio.sleep(0.01)
    # No event should have been published
    assert len(publisher.published_events) == 0


@pytest.mark.asyncio
async def test_no_duplicate_events_per_lifecycle_action(repo, instance_a, user_a):
    publisher = CapturingEventPublisher()
    runner = StrategyRunner(repository=repo, event_publisher=publisher)

    runner.start_instance(instance_a.id, user_a.id)
    await asyncio.sleep(0.01)
    assert len(publisher.published_events) == 1
