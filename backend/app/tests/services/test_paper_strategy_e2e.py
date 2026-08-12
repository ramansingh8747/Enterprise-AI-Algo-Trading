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
from app.brokers.base.broker_types import BrokerOrder
from app.exceptions.risk_exceptions import RiskLimitExceededException, TradingHaltedException


@pytest.fixture
def mock_db_session():
    return MagicMock()


@pytest.fixture
def mock_strategy_repo(mock_db_session):
    repo = MagicMock()
    repo.db = mock_db_session
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


def test_e2e_paper_strategy_flow_success(strategy_runner, mock_strategy_repo, mock_broker_order_service):
    """Phase 2 & Phase 3: Tests end-to-end paper strategy execution flow using deterministic strategy fixture."""
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

    signal_id = uuid.uuid4()
    signal_record = StrategySignal(
        id=signal_id,
        strategy_instance_id=instance_id,
        user_id=user_id,
        broker_id=broker_id,
        symbol="TATASTEEL",
        side="BUY",
        quantity=Decimal("10"),
        order_type="MARKET",
        signal_fingerprint="canonical_fp_1001",
        status="PROPOSED",
    )
    mock_strategy_repo.create_signal_if_not_exists.return_value = (signal_record, True)

    market_data = {
        "symbol": "TATASTEEL",
        "price": 150.50,
        "change_percent": 2.5, # Momentum buy signal
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    order = strategy_runner.execute_cycle(instance_id, user_id, market_data)

    assert order is not None
    assert order.order_id.startswith("PAPER-")
    assert order.symbol == "TATASTEEL"
    assert order.side == "BUY"
    assert order.status == "COMPLETE"
    assert signal_record.status == "EXECUTED"
    mock_broker_order_service.place_order.assert_not_called()


def test_paper_live_isolation_strict_boundary(strategy_runner, mock_strategy_repo, mock_broker_order_service):
    """Phase 4: Proves PAPER strategy instance never calls live broker SDK or place_order API."""
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
        broker_id=instance.broker_id,
        symbol="RELIANCE",
        side="BUY",
        quantity=Decimal("5"),
        order_type="MARKET",
        signal_fingerprint="fp_iso_1",
        status="PROPOSED",
    )
    mock_strategy_repo.create_signal_if_not_exists.return_value = (signal_record, True)

    market_data = {
        "symbol": "RELIANCE",
        "price": 2800.0,
        "change_percent": 1.8,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    res = strategy_runner.execute_cycle(instance_id, user_id, market_data)

    assert res is not None
    assert res.order_id.startswith("PAPER-")
    # Crucial security assertion: place_order MUST NOT be called in PAPER mode!
    mock_broker_order_service.place_order.assert_not_called()


def test_risk_engine_rejection_in_live_mode_marks_signal_rejected(strategy_runner, mock_strategy_repo, mock_broker_order_service):
    """Phase 7: Validates that RiskEngine rejection in LIVE mode sets signal status REJECTED and propagates exception."""
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
        symbol="SBIN",
        side="BUY",
        quantity=Decimal("10000"), # Exceeds risk limit
        order_type="MARKET",
        signal_fingerprint="fp_risk_1",
        status="PROPOSED",
    )
    mock_strategy_repo.create_signal_if_not_exists.return_value = (signal_record, True)

    # Mock RiskEngine rejection inside BrokerOrderService
    mock_broker_order_service.place_order.side_effect = RiskLimitExceededException("Order quantity exceeds maximum limit.")

    market_data = {
        "symbol": "SBIN",
        "price": 800.0,
        "change_percent": 3.0,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    with pytest.raises(RiskLimitExceededException) as exc_info:
        strategy_runner.execute_cycle(instance_id, user_id, market_data)

    assert "exceeds maximum limit" in str(exc_info.value)
    assert signal_record.status == "REJECTED"


def test_restart_recovery_prevents_duplicate_signal_execution(strategy_runner, mock_strategy_repo):
    """Phase 9: Simulates worker restart, confirming existing signal fingerprints prevent re-execution."""
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

    # Existing signal record returned after restart lookup
    existing_signal = StrategySignal(
        id=uuid.uuid4(),
        strategy_instance_id=instance_id,
        user_id=user_id,
        broker_id=instance.broker_id,
        symbol="INFY",
        side="BUY",
        quantity=Decimal("10"),
        order_type="MARKET",
        signal_fingerprint="fp_restart_99",
        status="EXECUTED",
    )
    mock_strategy_repo.create_signal_if_not_exists.return_value = (existing_signal, False) # False indicates duplicate!

    market_data = {
        "symbol": "INFY",
        "price": 1500.0,
        "change_percent": 1.5,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    with pytest.raises(DuplicateSignalException) as exc_info:
        strategy_runner.execute_cycle(instance_id, user_id, market_data)

    assert "already been processed" in str(exc_info.value)
