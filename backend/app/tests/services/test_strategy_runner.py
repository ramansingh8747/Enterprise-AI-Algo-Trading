import json
import uuid
import pytest
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from unittest.mock import MagicMock

from app.database.models.strategy import StrategyDefinition, StrategyInstance, StrategySignal
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


def test_paper_execution_mode_generates_proposed_signal_without_auto_order(strategy_runner, mock_strategy_repo, mock_broker_order_service):
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
        suggested_quantity=Decimal("10"),
        order_type="MARKET",
        price=Decimal("1500"),
        stop_loss=Decimal("1470.00"),
        target=Decimal("1560.00"),
        signal_fingerprint="fp123",
        status="PROPOSED",
    )
    mock_strategy_repo.create_signal_if_not_exists.return_value = (signal_record, True)

    now_ts = datetime.now(timezone.utc).isoformat()
    res = strategy_runner.execute_cycle(
        instance_id, user_id,
        {"symbol": "INFY", "price": 1500, "change_percent": 1.5, "timestamp": now_ts}
    )

    # Strategy cycle generates PROPOSED signal and NEVER automatically places order
    assert res is not None
    assert res.status == "PROPOSED"
    assert res.suggested_quantity == Decimal("10")
    assert res.symbol == "INFY"
    assert res.side == "BUY"
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
        status="PROPOSED",
    )
    mock_strategy_repo.create_signal_if_not_exists.return_value = (signal_record, False) # Duplicate

    now_ts = datetime.now(timezone.utc).isoformat()
    with pytest.raises(DuplicateSignalException) as exc_info:
        strategy_runner.execute_cycle(
            instance_id, user_id,
            {"symbol": "INFY", "price": 1500, "change_percent": 1.5, "timestamp": now_ts}
        )

    assert "Signal has already been processed" in str(exc_info.value)


def test_live_execution_mode_generates_signal_and_requires_manual_approval(strategy_runner, mock_strategy_repo, mock_broker_order_service):
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
        suggested_quantity=Decimal("10"),
        order_type="MARKET",
        price=Decimal("1500"),
        stop_loss=Decimal("1470.00"),
        target=Decimal("1560.00"),
        signal_fingerprint="fp123",
        status="PROPOSED",
    )
    mock_strategy_repo.create_signal_if_not_exists.return_value = (signal_record, True)
    mock_strategy_repo.get_signal_by_id.return_value = signal_record

    mock_broker_order_service.place_order.return_value = BrokerOrder(
        order_id="ORD-LIVE-770",
        symbol="INFY",
        side="BUY",
        quantity=Decimal("15"),
        status="COMPLETE",
    )

    now_ts = datetime.now(timezone.utc).isoformat()
    # 1. Strategy execution cycle generates PROPOSED signal and NEVER places live order
    res = strategy_runner.execute_cycle(
        instance_id, user_id,
        {"symbol": "INFY", "price": 1500, "change_percent": 1.5, "timestamp": now_ts}
    )

    assert res is not None
    assert res.status == "PROPOSED"
    mock_broker_order_service.place_order.assert_not_called()

    # 2. User approves signal with actual quantity 15 -> Manual BUY is placed
    approval_res = strategy_runner.approve_signal(
        user_id=user_id,
        signal_id=signal_record.id,
        actual_quantity=Decimal("15"),
        execution_mode="LIVE",
    )

    assert approval_res["status"] == "APPROVED"
    assert approval_res["order_id"] == "ORD-LIVE-770"
    assert approval_res["actual_quantity"] == "15"
    mock_broker_order_service.place_order.assert_called_once()


def test_trade_cooldown_suppresses_rapid_reentry(strategy_runner, mock_strategy_repo):
    """Verifies that an active trade cooldown suppresses signal generation to prevent whipsaw."""
    import json
    from app.database.models.strategy import StrategyDefinition

    user_id = uuid.uuid4()
    instance_id = uuid.uuid4()
    strat_def_id = uuid.uuid4()

    instance = StrategyInstance(
        id=instance_id,
        user_id=user_id,
        broker_id=uuid.uuid4(),
        strategy_definition_id=strat_def_id,
        execution_mode="PAPER",
        status="RUNNING",
    )
    defn = StrategyDefinition(
        id=strat_def_id,
        user_id=user_id,
        name="Momentum Strategy",
        strategy_type="DETERMINISTIC_MOMENTUM",
        config_json=json.dumps({"reentry_cooldown_seconds": 300}),
    )
    mock_strategy_repo.get_instance_for_user.return_value = instance
    mock_strategy_repo.get_definition_for_user.return_value = defn
    mock_strategy_repo.has_active_proposed_signal.return_value = False
    mock_strategy_repo.has_ignored_signal.return_value = False
    # Simulate recent execution within cooldown window
    mock_strategy_repo.has_recent_execution_or_signal.return_value = True

    now_ts = datetime.now(timezone.utc).isoformat()
    res = strategy_runner.execute_cycle(
        instance_id,
        user_id,
        {"symbol": "M&M", "price": 3420, "change_percent": 1.8, "timestamp": now_ts},
    )

    # Signal MUST be suppressed by cooldown guard
    assert res is None
    mock_strategy_repo.has_recent_execution_or_signal.assert_called_once_with(
        strategy_instance_id=instance_id,
        symbol="M&M",
        cooldown_seconds=300,
        user_id=user_id,
        side="BUY",
    )


def test_trade_cooldown_custom_override(strategy_runner, mock_strategy_repo):
    """Verifies that custom reentry_cooldown_seconds in config_json overrides the default."""
    import json
    from app.database.models.strategy import StrategyDefinition

    user_id = uuid.uuid4()
    instance_id = uuid.uuid4()
    strat_def_id = uuid.uuid4()

    instance = StrategyInstance(
        id=instance_id,
        user_id=user_id,
        broker_id=uuid.uuid4(),
        strategy_definition_id=strat_def_id,
        execution_mode="PAPER",
        status="RUNNING",
    )
    defn = StrategyDefinition(
        id=strat_def_id,
        user_id=user_id,
        name="Custom Cooldown Strategy",
        strategy_type="DETERMINISTIC_MOMENTUM",
        config_json=json.dumps({"reentry_cooldown_seconds": 600}),
    )
    mock_strategy_repo.get_instance_for_user.return_value = instance
    mock_strategy_repo.get_definition_for_user.return_value = defn
    mock_strategy_repo.has_active_proposed_signal.return_value = False
    mock_strategy_repo.has_ignored_signal.return_value = False
    mock_strategy_repo.has_recent_execution_or_signal.return_value = True

    now_ts = datetime.now(timezone.utc).isoformat()
    res = strategy_runner.execute_cycle(
        instance_id,
        user_id,
        {"symbol": "INFY", "price": 1120, "change_percent": 2.0, "timestamp": now_ts},
    )

    assert res is None
    # Verify custom 600 seconds cooldown was requested
    mock_strategy_repo.has_recent_execution_or_signal.assert_called_once_with(
        strategy_instance_id=instance_id,
        symbol="INFY",
        cooldown_seconds=600,
        user_id=user_id,
        side="BUY",
    )


def test_strategy_runner_blocks_post_market_hours(strategy_runner, mock_strategy_repo, monkeypatch):
    """Verifies that StrategyRunner blocks new entries when enforce_market_hours is enabled outside market hours."""
    import json
    from app.database.models.strategy import StrategyDefinition
    from app.services.market_timing_guard import MarketTimingGuard

    user_id = uuid.uuid4()
    instance_id = uuid.uuid4()
    strat_def_id = uuid.uuid4()

    instance = StrategyInstance(
        id=instance_id,
        user_id=user_id,
        broker_id=uuid.uuid4(),
        strategy_definition_id=strat_def_id,
        execution_mode="PAPER",
        status="RUNNING",
    )
    defn = StrategyDefinition(
        id=strat_def_id,
        user_id=user_id,
        name="Market Hours Protected Strategy",
        strategy_type="DETERMINISTIC_MOMENTUM",
        config_json=json.dumps({"enforce_market_hours": True}),
    )
    mock_strategy_repo.get_instance_for_user.return_value = instance
    mock_strategy_repo.get_definition_for_user.return_value = defn

    # Mock MarketTimingGuard to report market is closed
    monkeypatch.setattr(
        MarketTimingGuard,
        "is_market_open_for_new_orders",
        lambda dt=None, enforce_hours=None: (False, "New orders closed after 03:15 PM IST"),
    )

    now_ts = datetime.now(timezone.utc).isoformat()
    res = strategy_runner.execute_cycle(
        instance_id,
        user_id,
        {"symbol": "ASIANPAINT", "price": 2630, "change_percent": 2.5, "timestamp": now_ts},
    )

    # Must be blocked by Market Timing Guard
    assert res is None


def test_mtf_trend_filter_suppresses_fake_breakout_in_downtrend(strategy_runner, mock_strategy_repo):
    """Verifies that a BUY signal during a higher-timeframe downtrend (Price < 50 EMA) is suppressed as a fake breakout."""
    import json
    from app.database.models.strategy import StrategyDefinition

    user_id = uuid.uuid4()
    instance_id = uuid.uuid4()
    strat_def_id = uuid.uuid4()

    instance = StrategyInstance(
        id=instance_id,
        user_id=user_id,
        broker_id=uuid.uuid4(),
        strategy_definition_id=strat_def_id,
        execution_mode="PAPER",
        status="RUNNING",
    )
    defn = StrategyDefinition(
        id=strat_def_id,
        user_id=user_id,
        name="MTF Protected Strategy",
        strategy_type="DETERMINISTIC_MOMENTUM",
        config_json=json.dumps({"confirm_higher_timeframe": True, "bypass_market_hours": True}),
    )
    mock_strategy_repo.get_instance_for_user.return_value = instance
    mock_strategy_repo.get_definition_for_user.return_value = defn
    mock_strategy_repo.has_active_proposed_signal.return_value = False
    mock_strategy_repo.has_ignored_signal.return_value = False
    mock_strategy_repo.has_recent_execution_or_signal.return_value = False

    # Create candles in a strong downtrend (50 EMA is high around 1500, price plunged to 1200)
    downtrend_candles = [{"close": p, "price": p} for p in [1600, 1580, 1550, 1520, 1500, 1480, 1450, 1400, 1350, 1300, 1250, 1200]]

    now_ts = datetime.now(timezone.utc).isoformat()
    res = strategy_runner.execute_cycle(
        instance_id,
        user_id,
        {
            "symbol": "TITAN",
            "price": 1210.0,
            "change_percent": 1.5,
            "candles": downtrend_candles,
            "timestamp": now_ts,
        },
    )

    # Must be suppressed by MTF trend filter
    assert res is None


def test_mtf_trend_filter_approves_when_trend_aligned(strategy_runner, mock_strategy_repo):
    """Verifies that a BUY breakout is approved when trading above 50 EMA in bullish alignment."""
    import json
    from app.database.models.strategy import StrategyDefinition

    user_id = uuid.uuid4()
    instance_id = uuid.uuid4()
    strat_def_id = uuid.uuid4()

    instance = StrategyInstance(
        id=instance_id,
        user_id=user_id,
        broker_id=uuid.uuid4(),
        strategy_definition_id=strat_def_id,
        execution_mode="PAPER",
        status="RUNNING",
    )
    defn = StrategyDefinition(
        id=strat_def_id,
        user_id=user_id,
        name="MTF Protected Strategy",
        strategy_type="DETERMINISTIC_MOMENTUM",
        config_json=json.dumps({"confirm_higher_timeframe": True, "bypass_market_hours": True}),
    )
    mock_strategy_repo.get_instance_for_user.return_value = instance
    mock_strategy_repo.get_definition_for_user.return_value = defn
    mock_strategy_repo.has_active_proposed_signal.return_value = False
    mock_strategy_repo.has_ignored_signal.return_value = False
    mock_strategy_repo.has_recent_execution_or_signal.return_value = False

    def fake_create_signal(**kwargs):
        from app.database.models.strategy import StrategySignal
        sig = StrategySignal(
            id=uuid.uuid4(),
            strategy_instance_id=instance_id,
            user_id=user_id,
            broker_id=instance.broker_id,
            symbol=kwargs.get("symbol", "TITAN"),
            side="BUY",
            quantity=kwargs.get("quantity", Decimal("10")),
            status="PROPOSED",
        )
        return (sig, True)

    mock_strategy_repo.create_signal_if_not_exists.side_effect = fake_create_signal

    # Create candles in a strong uptrend (price 1650 > 50 EMA)
    uptrend_candles = [{"close": p, "price": p} for p in [1200, 1250, 1300, 1350, 1400, 1450, 1500, 1550, 1600, 1650]]

    now_ts = datetime.now(timezone.utc).isoformat()
    res = strategy_runner.execute_cycle(
        instance_id,
        user_id,
        {
            "symbol": "TITAN",
            "price": 1660.0,
            "change_percent": 2.0,
            "candles": uptrend_candles,
            "timestamp": now_ts,
        },
    )

    # Must be approved
    assert res is not None
    assert res.status == "PROPOSED"


def test_dynamic_atr_stop_loss_and_target_calculation(strategy_runner, mock_strategy_repo):
    """
    Test: Verifies that Dynamic ATR-based Stop-Loss and Target are calculated
    proportionately to real candlestick volatility (1.5x ATR for SL, 1:2 R:R for Target).
    """
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
    defn = StrategyDefinition(
        id=instance.strategy_definition_id,
        user_id=user_id,
        name="ATR Strategy",
        strategy_type="DETERMINISTIC_MOMENTUM",
        config_json=json.dumps({"bypass_market_hours": True}),
    )
    mock_strategy_repo.get_instance_for_user.return_value = instance
    mock_strategy_repo.get_definition_for_user.return_value = defn
    mock_strategy_repo.has_active_proposed_signal.return_value = False
    mock_strategy_repo.has_ignored_signal.return_value = False
    mock_strategy_repo.has_recent_execution_or_signal.return_value = False

    captured_kwargs = {}

    def fake_create_signal(**kwargs):
        captured_kwargs.update(kwargs)
        sig = StrategySignal(
            id=uuid.uuid4(),
            strategy_instance_id=instance_id,
            user_id=user_id,
            broker_id=instance.broker_id,
            symbol=kwargs.get("symbol", "TATAMOTORS"),
            side=kwargs.get("side", "BUY"),
            quantity=kwargs.get("quantity", Decimal("10")),
            stop_loss=kwargs.get("stop_loss"),
            target=kwargs.get("target"),
            status="PROPOSED",
        )
        return (sig, True)

    mock_strategy_repo.create_signal_if_not_exists.side_effect = fake_create_signal

    # Candlestick sequence with High-Low spread of ~20 points
    candles = [
        {"open": 980, "high": 995, "low": 975, "close": 990},
        {"open": 990, "high": 1010, "low": 988, "close": 1005},
        {"open": 1005, "high": 1025, "low": 1000, "close": 1020},
    ]

    now_ts = datetime.now(timezone.utc).isoformat()
    res = strategy_runner.execute_cycle(
        instance_id,
        user_id,
        {
            "symbol": "TATAMOTORS",
            "price": 1020.0,
            "change_percent": 2.5,
            "candles": candles,
            "timestamp": now_ts,
        },
    )

    assert res is not None
    assert captured_kwargs.get("stop_loss") is not None
    assert captured_kwargs.get("target") is not None
    # ATR Stop Loss distance should be ~1.5x ATR below entry price
    assert captured_kwargs["stop_loss"] < Decimal("1020.00")
    assert captured_kwargs["target"] > Decimal("1020.00")
    # Verify 1:2 R:R
    sl_dist = Decimal("1020.00") - captured_kwargs["stop_loss"]
    target_dist = captured_kwargs["target"] - Decimal("1020.00")
    assert abs(target_dist - (sl_dist * 2)) <= Decimal("0.05")


def test_market_sentiment_guard_suppresses_buy_during_nifty_bloodbath(strategy_runner, mock_strategy_repo):
    """
    Test: Verifies that when NIFTY/Benchmark index is in heavy downtrend (e.g. -1.8%),
    counter-trend BUY signals on individual equities are suppressed to protect capital.
    """
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
    defn = StrategyDefinition(
        id=instance.strategy_definition_id,
        user_id=user_id,
        name="Sentiment Guard Strategy",
        strategy_type="DETERMINISTIC_MOMENTUM",
        config_json=json.dumps({"enforce_market_sentiment": True, "bypass_market_hours": True}),
    )
    mock_strategy_repo.get_instance_for_user.return_value = instance
    mock_strategy_repo.get_definition_for_user.return_value = defn
    mock_strategy_repo.has_active_proposed_signal.return_value = False
    mock_strategy_repo.has_ignored_signal.return_value = False
    mock_strategy_repo.has_recent_execution_or_signal.return_value = False

    now_ts = datetime.now(timezone.utc).isoformat()
    # Market data with Nifty down -1.85% (bloodbath day)
    res = strategy_runner.execute_cycle(
        instance_id,
        user_id,
        {
            "symbol": "INFY",
            "price": 1800.0,
            "change_percent": 1.5,
            "nifty_change_percent": -1.85,
            "timestamp": now_ts,
        },
    )

    # Signal MUST be suppressed
    assert res is None


def test_market_sentiment_guard_allows_buy_when_sentiment_is_supportive(strategy_runner, mock_strategy_repo):
    """
    Test: Verifies that when broad index trend is supportive (e.g. +0.4%),
    valid BUY signals pass through smoothly.
    """
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
    defn = StrategyDefinition(
        id=instance.strategy_definition_id,
        user_id=user_id,
        name="Sentiment Guard Strategy",
        strategy_type="DETERMINISTIC_MOMENTUM",
        config_json=json.dumps({"enforce_market_sentiment": True, "bypass_market_hours": True}),
    )
    mock_strategy_repo.get_instance_for_user.return_value = instance
    mock_strategy_repo.get_definition_for_user.return_value = defn
    mock_strategy_repo.has_active_proposed_signal.return_value = False
    mock_strategy_repo.has_ignored_signal.return_value = False
    mock_strategy_repo.has_recent_execution_or_signal.return_value = False

    def fake_create_signal(**kwargs):
        sig = StrategySignal(
            id=uuid.uuid4(),
            strategy_instance_id=instance_id,
            user_id=user_id,
            broker_id=instance.broker_id,
            symbol=kwargs.get("symbol", "INFY"),
            side="BUY",
            quantity=kwargs.get("quantity", Decimal("10")),
            status="PROPOSED",
        )
        return (sig, True)

    mock_strategy_repo.create_signal_if_not_exists.side_effect = fake_create_signal

    now_ts = datetime.now(timezone.utc).isoformat()
    # Market data with Nifty positive (+0.45%)
    res = strategy_runner.execute_cycle(
        instance_id,
        user_id,
        {
            "symbol": "INFY",
            "price": 1800.0,
            "change_percent": 1.5,
            "nifty_change_percent": 0.45,
            "timestamp": now_ts,
        },
    )

    # Signal MUST be permitted
    assert res is not None
    assert res.status == "PROPOSED"
    assert res.symbol == "INFY"


def test_premature_sell_signal_suppressed_after_recent_buy(strategy_runner, mock_strategy_repo):
    """
    Test: Verifies that when user bought a share, if strategy generates a SELL signal
    shortly after (e.g. 10s later due to minor tick fluctuation), it is suppressed by the
    minimum holding stabilization guard.
    """
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
    defn = StrategyDefinition(
        id=instance.strategy_definition_id,
        user_id=user_id,
        name="Anti Whipsaw Strategy",
        strategy_type="DETERMINISTIC_MOMENTUM",
        config_json=json.dumps({"min_holding_seconds": 60, "bypass_market_hours": True}),
    )
    mock_strategy_repo.get_instance_for_user.return_value = instance
    mock_strategy_repo.get_definition_for_user.return_value = defn
    mock_strategy_repo.has_active_proposed_signal.return_value = False
    mock_strategy_repo.has_ignored_signal.return_value = False

    # Simulate that user recently executed a BUY 10 seconds ago (holding stabilization active)
    def fake_has_recent(strategy_instance_id, symbol, cooldown_seconds, user_id, side):
        if side == "BUY":
            return True  # Recent BUY exists within 60 seconds
        return False

    mock_strategy_repo.has_recent_execution_or_signal.side_effect = fake_has_recent

    # Mock open position of 10 shares
    mock_pos = MagicMock()
    mock_pos.quantity = Decimal("10.0000")
    mock_pos.status = "OPEN"

    mock_port = MagicMock()
    mock_port.id = uuid.uuid4()
    mock_paper_repo = MagicMock()
    mock_paper_repo.get_or_create_default_portfolio.return_value = mock_port
    mock_paper_repo.get_position.return_value = mock_pos
    strategy_runner._paper_accounting_service = MagicMock(repository=mock_paper_repo)

    now_ts = datetime.now(timezone.utc).isoformat()
    # Market data with price dropping slightly (-0.5%), triggering a SELL signal in strategy
    res = strategy_runner.execute_cycle(
        instance_id,
        user_id,
        {
            "symbol": "TCS",
            "price": 3500.0,
            "change_percent": -1.5,
            "timestamp": now_ts,
        },
    )

    # Premature SELL signal MUST be suppressed
    assert res is None


def test_volume_spike_guard_suppresses_low_volume_fake_breakout(strategy_runner, mock_strategy_repo):
    """
    Test: Verifies that when confirm_volume_spike is enabled, breakout BUY signals
    occurring on weak/dry volume (< 1.5x average) are suppressed as fake breakout traps.
    """
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
    defn = StrategyDefinition(
        id=instance.strategy_definition_id,
        user_id=user_id,
        name="Volume Breakout Strategy",
        strategy_type="DETERMINISTIC_MOMENTUM",
        config_json=json.dumps({"confirm_volume_spike": True, "volume_multiplier": 1.5, "bypass_market_hours": True}),
    )
    mock_strategy_repo.get_instance_for_user.return_value = instance
    mock_strategy_repo.get_definition_for_user.return_value = defn
    mock_strategy_repo.has_active_proposed_signal.return_value = False
    mock_strategy_repo.has_ignored_signal.return_value = False
    mock_strategy_repo.has_recent_execution_or_signal.return_value = False

    # Historical candles with average volume of 10,000, current candle volume is only 8,000 (0.8x avg)
    candles = [
        {"open": 100, "high": 102, "low": 99, "close": 101, "volume": 10000},
        {"open": 101, "high": 103, "low": 100, "close": 102, "volume": 10000},
        {"open": 102, "high": 105, "low": 101, "close": 104, "volume": 8000},
    ]

    now_ts = datetime.now(timezone.utc).isoformat()
    res = strategy_runner.execute_cycle(
        instance_id,
        user_id,
        {
            "symbol": "TATAMOTORS",
            "price": 104.0,
            "change_percent": 2.5,
            "candles": candles,
            "timestamp": now_ts,
        },
    )

    # Must be suppressed due to low volume
    assert res is None


def test_volume_spike_guard_allows_high_volume_genuine_breakout(strategy_runner, mock_strategy_repo):
    """
    Test: Verifies that genuine breakouts accompanied by large institutional volume
    (e.g. 2.5x of 20-period average) pass through with volume confirmation metrics.
    """
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
    defn = StrategyDefinition(
        id=instance.strategy_definition_id,
        user_id=user_id,
        name="Volume Breakout Strategy",
        strategy_type="DETERMINISTIC_MOMENTUM",
        config_json=json.dumps({"confirm_volume_spike": True, "volume_multiplier": 1.5, "bypass_market_hours": True}),
    )
    mock_strategy_repo.get_instance_for_user.return_value = instance
    mock_strategy_repo.get_definition_for_user.return_value = defn
    mock_strategy_repo.has_active_proposed_signal.return_value = False
    mock_strategy_repo.has_ignored_signal.return_value = False
    mock_strategy_repo.has_recent_execution_or_signal.return_value = False

    def fake_create_signal(**kwargs):
        sig = StrategySignal(
            id=uuid.uuid4(),
            strategy_instance_id=instance_id,
            user_id=user_id,
            broker_id=instance.broker_id,
            symbol=kwargs.get("symbol", "TATAMOTORS"),
            side="BUY",
            quantity=kwargs.get("quantity", Decimal("10")),
            status="PROPOSED",
        )
        return (sig, True)

    mock_strategy_repo.create_signal_if_not_exists.side_effect = fake_create_signal

    # Historical candles with average volume of 10,000, current candle has massive surge 25,000 (2.5x avg)
    candles = [
        {"open": 100, "high": 102, "low": 99, "close": 101, "volume": 10000},
        {"open": 101, "high": 103, "low": 100, "close": 102, "volume": 10000},
        {"open": 102, "high": 106, "low": 101, "close": 105, "volume": 25000},
    ]

    now_ts = datetime.now(timezone.utc).isoformat()
    res = strategy_runner.execute_cycle(
        instance_id,
        user_id,
        {
            "symbol": "TATAMOTORS",
            "price": 105.0,
            "change_percent": 2.5,
            "candles": candles,
            "timestamp": now_ts,
        },
    )

    # Must be permitted
    assert res is not None
    assert res.status == "PROPOSED"
    assert res.symbol == "TATAMOTORS"


def test_budget_based_sizing_skips_unaffordable_and_sizes_affordable(strategy_runner, mock_strategy_repo):
    """
    Test: Verifies that when budget is ₹1,000:
    1. TCS at ₹3,500 is skipped (quantity 0).
    2. Zomato at ₹250 sizes exactly 4 shares (₹1,000 / 250).
    """
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
    defn = StrategyDefinition(
        id=instance.strategy_definition_id,
        user_id=user_id,
        name="Budget Strategy",
        strategy_type="DETERMINISTIC_MOMENTUM",
        config_json=json.dumps({
            "position_sizing_mode": "BUDGET_BASED",
            "capital": "1000.00",
            "bypass_market_hours": True,
        }),
    )
    mock_strategy_repo.get_instance_for_user.return_value = instance
    mock_strategy_repo.get_definition_for_user.return_value = defn
    mock_strategy_repo.has_active_proposed_signal.return_value = False
    mock_strategy_repo.has_ignored_signal.return_value = False
    mock_strategy_repo.has_recent_execution_or_signal.return_value = False

    captured_kwargs = {}

    def fake_create_signal(**kwargs):
        captured_kwargs.update(kwargs)
        sig = StrategySignal(
            id=uuid.uuid4(),
            strategy_instance_id=instance_id,
            user_id=user_id,
            broker_id=instance.broker_id,
            symbol=kwargs.get("symbol"),
            side=kwargs.get("side"),
            quantity=kwargs.get("quantity"),
            status="PROPOSED",
        )
        return (sig, True)

    mock_strategy_repo.create_signal_if_not_exists.side_effect = fake_create_signal

    now_ts = datetime.now(timezone.utc).isoformat()

    # Case 1: Expensive stock TCS (₹3500 > ₹1000) -> Must be skipped
    res_tcs = strategy_runner.execute_cycle(
        instance_id,
        user_id,
        {"symbol": "TCS", "price": 3500.0, "change_percent": 2.0, "timestamp": now_ts},
    )
    assert res_tcs is None

    # Case 2: Affordable stock Zomato (₹250 <= ₹1000) -> Exactly 4 shares
    res_zomato = strategy_runner.execute_cycle(
        instance_id,
        user_id,
        {"symbol": "ZOMATO", "price": 250.0, "change_percent": 2.0, "timestamp": now_ts},
    )
    assert res_zomato is not None
    assert captured_kwargs["quantity"] == Decimal("4")


def test_autonomous_auto_pilot_mode_auto_executes_signal(strategy_runner, mock_strategy_repo):
    """
    Test: Verifies that when auto_pilot / autonomous_execution is enabled,
    the signal is immediately auto-approved and executed without manual human intervention.
    """
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
    defn = StrategyDefinition(
        id=instance.strategy_definition_id,
        user_id=user_id,
        name="Auto Pilot Strategy",
        strategy_type="DETERMINISTIC_MOMENTUM",
        config_json=json.dumps({
            "auto_pilot": True,
            "bypass_market_hours": True,
        }),
    )
    mock_strategy_repo.get_instance_for_user.return_value = instance
    mock_strategy_repo.get_definition_for_user.return_value = defn
    mock_strategy_repo.has_active_proposed_signal.return_value = False
    mock_strategy_repo.has_ignored_signal.return_value = False
    mock_strategy_repo.has_recent_execution_or_signal.return_value = False

    sig_id = uuid.uuid4()
    created_sig = StrategySignal(
        id=sig_id,
        strategy_instance_id=instance_id,
        user_id=user_id,
        broker_id=instance.broker_id,
        symbol="ITC",
        side="BUY",
        quantity=Decimal("10"),
        status="PROPOSED",
    )
    mock_strategy_repo.create_signal_if_not_exists.return_value = (created_sig, True)
    mock_strategy_repo.get_signal_by_id.return_value = created_sig

    # Mock approve_signal behavior
    strategy_runner.approve_signal = MagicMock(return_value={"status": "APPROVED", "order_id": "PAPER-AUTO-12345"})

    now_ts = datetime.now(timezone.utc).isoformat()
    res = strategy_runner.execute_cycle(
        instance_id,
        user_id,
        {"symbol": "ITC", "price": 480.0, "change_percent": 1.5, "timestamp": now_ts},
    )

    assert res is not None
    # Auto-pilot should have called approve_signal
    strategy_runner.approve_signal.assert_called_once()
    assert res.status == "APPROVED"
    assert res.executed_order_id == "PAPER-AUTO-12345"




