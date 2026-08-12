import uuid
import pytest
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from unittest.mock import MagicMock

from app.database.models.strategy import StrategyInstance, StrategySignal
from app.exceptions.strategy_exceptions import (
    StaleDataException,
    DuplicateSignalException,
    InvalidLifecycleTransitionException,
)
from app.services.strategy_engine.strategy_runner import StrategyRunner
from app.services.strategy_engine.base_strategy import DeterministicMomentumStrategy
from app.database.repositories.strategy_repository import StrategyRepository
from app.brokers.base.broker_types import BrokerOrder


@pytest.fixture
def mock_db_session():
    return MagicMock()


@pytest.fixture
def mock_strategy_repo(mock_db_session):
    repo = MagicMock()
    return repo


@pytest.fixture
def mock_broker_order_service():
    return MagicMock()


@pytest.fixture
def strategy_runner(mock_strategy_repo, mock_broker_order_service):
    return StrategyRunner(
        repository=mock_strategy_repo,
        broker_order_service=mock_broker_order_service,
        max_data_age_seconds=10,
    )


def test_strategy_runner_skips_if_not_running(strategy_runner, mock_strategy_repo):
    user_id = uuid.uuid4()
    instance_id = uuid.uuid4()

    instance = StrategyInstance(
        id=instance_id,
        user_id=user_id,
        broker_id=uuid.uuid4(),
        strategy_definition_id=uuid.uuid4(),
        execution_mode="PAPER",
        status="STOPPED", # Not RUNNING
    )
    mock_strategy_repo.get_instance_for_user.return_value = instance

    res = strategy_runner.execute_cycle(instance_id, user_id, {"symbol": "INFY", "price": 1500, "change_percent": 1.5, "timestamp": datetime.now(timezone.utc).isoformat()})

    assert res is None


def test_stale_data_guard_rejects_missing_timestamp(strategy_runner, mock_strategy_repo):
    user_id = uuid.uuid4()
    instance_id = uuid.uuid4()

    instance = StrategyInstance(
        id=instance_id,
        user_id=user_id,
        broker_id=uuid.uuid4(),
        strategy_definition_id=uuid.uuid4(),
        execution_mode="PAPER",
        status="RUNNING",
    )
    mock_strategy_repo.get_instance_for_user.return_value = instance

    with pytest.raises(StaleDataException) as exc_info:
        strategy_runner.execute_cycle(instance_id, user_id, {"symbol": "INFY", "price": 1500, "change_percent": 1.5}) # Missing timestamp

    assert "missing a valid timestamp" in str(exc_info.value)


def test_stale_data_guard_rejects_old_timestamp(strategy_runner, mock_strategy_repo):
    user_id = uuid.uuid4()
    instance_id = uuid.uuid4()

    instance = StrategyInstance(
        id=instance_id,
        user_id=user_id,
        broker_id=uuid.uuid4(),
        strategy_definition_id=uuid.uuid4(),
        execution_mode="PAPER",
        status="RUNNING",
    )
    mock_strategy_repo.get_instance_for_user.return_value = instance

    old_ts = (datetime.now(timezone.utc) - timedelta(seconds=15)).isoformat()

    with pytest.raises(StaleDataException) as exc_info:
        strategy_runner.execute_cycle(instance_id, user_id, {"symbol": "INFY", "price": 1500, "change_percent": 1.5, "timestamp": old_ts})

    assert "Market data is stale" in str(exc_info.value)


def test_paper_execution_mode_returns_simulated_order_without_live_broker_call(strategy_runner, mock_strategy_repo, mock_broker_order_service):
    user_id = uuid.uuid4()
    instance_id = uuid.uuid4()
    broker_id = uuid.uuid4()

    instance = StrategyInstance(
        id=instance_id,
        user_id=user_id,
        broker_id=broker_id,
        strategy_definition_id=uuid.uuid4(),
        execution_mode="PAPER",
        status="RUNNING",
    )
    mock_strategy_repo.get_instance_for_user.return_value = instance

    signal_record = StrategySignal(
        id=uuid.uuid4(),
        strategy_instance_id=instance_id,
        user_id=user_id,
        broker_id=broker_id,
        symbol="INFY",
        side="BUY",
        quantity=Decimal("10"),
        order_type="MARKET",
        signal_fingerprint="fp123",
        status="PROPOSED",
    )
    mock_strategy_repo.create_signal_if_not_exists.return_value = (signal_record, True)

    now_ts = datetime.now(timezone.utc).isoformat()
    res = strategy_runner.execute_cycle(
        instance_id, user_id,
        {"symbol": "INFY", "price": 1500, "change_percent": 1.5, "timestamp": now_ts}
    )

    assert res is not None
    assert res.order_id.startswith("PAPER-")
    assert res.symbol == "INFY"
    assert res.side == "BUY"
    assert res.status == "COMPLETE"
    mock_broker_order_service.place_order.assert_not_called()


def test_duplicate_signal_guard_raises_error(strategy_runner, mock_strategy_repo):
    user_id = uuid.uuid4()
    instance_id = uuid.uuid4()

    instance = StrategyInstance(
        id=instance_id,
        user_id=user_id,
        broker_id=uuid.uuid4(),
        strategy_definition_id=uuid.uuid4(),
        execution_mode="PAPER",
        status="RUNNING",
    )
    mock_strategy_repo.get_instance_for_user.return_value = instance

    signal_record = StrategySignal(
        id=uuid.uuid4(),
        strategy_instance_id=instance_id,
        user_id=user_id,
        broker_id=uuid.uuid4(),
        symbol="INFY",
        side="BUY",
        quantity=Decimal("10"),
        order_type="MARKET",
        signal_fingerprint="fp123",
        status="EXECUTED",
    )
    mock_strategy_repo.create_signal_if_not_exists.return_value = (signal_record, False) # Duplicate

    now_ts = datetime.now(timezone.utc).isoformat()
    with pytest.raises(DuplicateSignalException) as exc_info:
        strategy_runner.execute_cycle(
            instance_id, user_id,
            {"symbol": "INFY", "price": 1500, "change_percent": 1.5, "timestamp": now_ts}
        )

    assert "Signal has already been processed" in str(exc_info.value)


def test_live_execution_mode_routes_order_through_broker_order_service(strategy_runner, mock_strategy_repo, mock_broker_order_service):
    user_id = uuid.uuid4()
    instance_id = uuid.uuid4()
    broker_id = uuid.uuid4()

    instance = StrategyInstance(
        id=instance_id,
        user_id=user_id,
        broker_id=broker_id,
        strategy_definition_id=uuid.uuid4(),
        execution_mode="LIVE",
        status="RUNNING",
    )
    mock_strategy_repo.get_instance_for_user.return_value = instance

    signal_record = StrategySignal(
        id=uuid.uuid4(),
        strategy_instance_id=instance_id,
        user_id=user_id,
        broker_id=broker_id,
        symbol="INFY",
        side="BUY",
        quantity=Decimal("10"),
        order_type="MARKET",
        signal_fingerprint="fp123",
        status="PROPOSED",
    )
    mock_strategy_repo.create_signal_if_not_exists.return_value = (signal_record, True)

    mock_broker_order_service.place_order.return_value = BrokerOrder(
        order_id="ORD-LIVE-770",
        symbol="INFY",
        side="BUY",
        quantity=Decimal("10"),
        status="COMPLETE",
    )

    now_ts = datetime.now(timezone.utc).isoformat()
    res = strategy_runner.execute_cycle(
        instance_id, user_id,
        {"symbol": "INFY", "price": 1500, "change_percent": 1.5, "timestamp": now_ts}
    )

    assert res is not None
    assert res.order_id == "ORD-LIVE-770"
    mock_broker_order_service.place_order.assert_called_once()
