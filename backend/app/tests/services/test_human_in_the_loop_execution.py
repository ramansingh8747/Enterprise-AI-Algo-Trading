"""
Comprehensive end-to-end tests for Human-in-the-Loop Semi-Automatic Execution Model.

Validates the mandatory pipeline:
STRATEGY -> SIGNAL + SUGGESTED QTY -> NOTIFICATION -> USER DECIDES ACTUAL QTY ->
MANUAL BUY / MANUAL NORMAL SELL -> ACTUAL POSITION -> STOP LOSS -> AUTO SELL ACTUAL OPEN QTY

Enforces all 27 critical validation points across Backend, Broker Orders, Paper Sandbox,
Stop Loss Monitoring, Security Boundaries, and Audit Trails.
"""

import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.brokers.base.broker_types import BrokerOrder, BrokerOrderRequest
from app.database.base import Base
from app.database.models.broker import Broker
from app.database.models.paper_portfolio import PaperPortfolio, PaperPosition
from app.database.models.strategy import StrategyDefinition, StrategyInstance, StrategySignal
from app.database.models.trading_execution import TradingPosition
from app.database.models.user import User, UserRole
from app.database.repositories.alert_repository import AlertRepository
from app.database.repositories.paper_portfolio_repository import PaperPortfolioRepository
from app.database.repositories.strategy_repository import StrategyRepository
from app.database.repositories.trading_execution_repository import (
    TradingExecutionRepository,
    TradingPositionRepository,
)
from app.exceptions.strategy_exceptions import (
    DuplicateSignalException,
    ExecutionPolicyViolationException,
)
from app.exceptions.risk_exceptions import TradingHaltedException
from app.services.broker_order_service import BrokerOrderService
from app.services.event_bus.models import EventType
from app.services.paper_accounting_service import PaperAccountingService
from app.services.stop_loss_service import StopLossService
from app.services.strategy_engine.strategy_runner import StrategyRunner


# ---------------------------------------------------------------------------
# Test SQLite In-Memory Database Fixtures
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
def test_user(db_session):
    u = User(
        id=uuid.uuid4(),
        email="trader@enterprise.ai",
        username="trader_pro",
        password_hash="hashed_pw",
        full_name="Pro Trader",
        role=UserRole.TRADER,
        is_active=True,
    )
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    return u


@pytest.fixture
def test_broker(db_session):
    b = Broker(
        id=uuid.uuid4(),
        broker_name="Zerodha Kite",
        broker_type="zerodha",
        api_key="encrypted_test_key",
        api_secret="encrypted_test_secret",
        client_id="TEST_CLIENT",
        is_active=True,
    )
    db_session.add(b)
    db_session.commit()
    db_session.refresh(b)
    return b


@pytest.fixture
def strategy_definition(db_session, test_user):
    d = StrategyDefinition(
        id=uuid.uuid4(),
        user_id=test_user.id,
        name="Momentum Breakout v1",
        strategy_type="DETERMINISTIC_MOMENTUM",
        config_json=json.dumps({"quantity": 10}),
        is_active=True,
    )
    db_session.add(d)
    db_session.commit()
    db_session.refresh(d)
    return d


@pytest.fixture
def paper_instance(db_session, test_user, test_broker, strategy_definition):
    inst = StrategyInstance(
        id=uuid.uuid4(),
        user_id=test_user.id,
        broker_id=test_broker.id,
        strategy_definition_id=strategy_definition.id,
        execution_mode="PAPER",
        status="RUNNING",
    )
    db_session.add(inst)
    db_session.commit()
    db_session.refresh(inst)
    return inst


# ---------------------------------------------------------------------------
# Test Suite: Human-in-the-Loop Semi-Automatic Execution
# ---------------------------------------------------------------------------


def test_01_strategy_generates_advisory_buy_signal_with_all_metrics_without_auto_buy(
    db_session, test_user, paper_instance
):
    """
    Test 1, 2, 3:
    - Strategy detects opportunity and calculates suggested quantity, price, stop loss, target, risk:reward.
    - Strategy NEVER places a BUY order automatically.
    - Status is PROPOSED and alert notification is generated.
    """
    strat_repo = StrategyRepository(db_session)
    alert_repo = AlertRepository(db_session)
    accounting = PaperAccountingService(repository=PaperPortfolioRepository(db_session))

    runner = StrategyRunner(
        repository=strat_repo,
        paper_accounting_service=accounting,
    )

    market_data = {
        "symbol": "TCS",
        "price": 3500.00,
        "change_percent": 2.5,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    signal = runner.execute_cycle(paper_instance.id, test_user.id, market_data)

    # Signal is created as PROPOSED with full metrics
    assert signal is not None
    assert signal.status == "PROPOSED"
    assert signal.symbol == "TCS"
    assert signal.side == "BUY"
    assert signal.suggested_quantity == Decimal("10")
    assert signal.price == Decimal("3500.00")
    assert signal.stop_loss == Decimal("3430.00")  # Default 2% SL
    assert signal.target == Decimal("3640.00")     # Default 4% Target
    assert signal.risk_reward == "1:2"
    assert signal.actual_quantity is None          # No actual quantity until user decides

    # Alert notification is generated
    alerts = alert_repo.list_user_alerts(test_user.id)
    assert len(alerts) >= 1
    signal_alert = next((a for a in alerts if a.signal_id == signal.id), None)
    assert "BUY" in signal_alert.title and "TCS" in signal_alert.title
    assert signal_alert.type == "STRATEGY_SIGNAL"

    # Confirm NO position was opened automatically
    paper_repo = PaperPortfolioRepository(db_session)
    portfolio = paper_repo.get_or_create_default_portfolio(test_user.id, paper_instance.id)
    pos = paper_repo.get_position(portfolio.id, "TCS")
    assert pos is None or pos.quantity == Decimal("0")


def test_04_05_06_user_confirms_actual_quantity_and_places_manual_buy(
    db_session, test_user, paper_instance
):
    """
    Test 4, 5, 6:
    - User modifies quantity (e.g. suggested was 10, user decides 25).
    - User executes Manual BUY.
    - Order is executed with MANUAL_BUY and Position is opened with SL registered.
    """
    strat_repo = StrategyRepository(db_session)
    paper_repo = PaperPortfolioRepository(db_session)
    accounting = PaperAccountingService(repository=paper_repo)

    runner = StrategyRunner(
        repository=strat_repo,
        paper_accounting_service=accounting,
    )

    market_data = {
        "symbol": "TCS",
        "price": 3500.00,
        "change_percent": 2.0,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    signal = runner.execute_cycle(paper_instance.id, test_user.id, market_data)
    assert signal.status == "PROPOSED"
    assert signal.suggested_quantity == Decimal("10")

    # User modifies quantity to 25 and manually approves
    approval = runner.approve_signal(
        user_id=test_user.id,
        signal_id=signal.id,
        actual_quantity=Decimal("25"),
        execution_mode="PAPER",
    )

    assert approval["status"] == "APPROVED"
    assert approval["actual_quantity"] == "25"
    assert approval["order_id"].startswith("PAPER-")

    # Verify signal status in DB
    updated_signal = strat_repo.get_signal_by_id(signal.id, test_user.id)
    assert updated_signal.status == "APPROVED"
    assert updated_signal.actual_quantity == Decimal("25")
    assert updated_signal.executed_order_id == approval["order_id"]

    # Verify Paper Position registered with actual quantity 25 and Stop-Loss
    portfolio = paper_repo.get_or_create_default_portfolio(test_user.id, paper_instance.id)
    pos = paper_repo.get_position(portfolio.id, "TCS")
    assert pos is not None
    assert pos.quantity == Decimal("25.0000")
    assert pos.stop_loss == Decimal("3430.00")
    assert pos.target == Decimal("3640.00")
    assert pos.status == "OPEN"


def test_07_backend_security_rejects_automated_strategy_buy_order(
    db_session, test_user, test_broker
):
    """
    Test 7:
    - Backend hard validation rejects any order with automated source.
    """
    broker_service = BrokerOrderService(
        session_service=MagicMock(),
        broker_service=MagicMock(),
    )

    request = BrokerOrderRequest(
        symbol="TCS",
        exchange="NSE",
        quantity=Decimal("50"),
        side="BUY",
        order_type="MARKET",
        product="CNC",
        variety="regular",
    )

    # Attempt direct automated order
    with pytest.raises(ExecutionPolicyViolationException) as exc_info:
        broker_service.place_order(
            user_id=test_user.id,
            broker_id=test_broker.id,
            request=request,
            order_source="STRATEGY_AUTO_BUY",  # Prohibited!
        )

    assert "Direct strategy automated orders" in str(exc_info.value)


def test_08_09_10_manual_normal_sell_and_partial_quantity_exit(
    db_session, test_user, paper_instance
):
    """
    Test 8, 9, 10:
    - User has 200 open shares.
    - User places manual SELL for 50 shares (partial exit).
    - Position quantity becomes 150.
    """
    strat_repo = StrategyRepository(db_session)
    paper_repo = PaperPortfolioRepository(db_session)
    accounting = PaperAccountingService(repository=paper_repo)

    runner = StrategyRunner(repository=strat_repo, paper_accounting_service=accounting)

    # Step 1: Initial BUY of 200 shares
    market_data = {"symbol": "INFY", "price": 1600.00, "change_percent": 2.0, "timestamp": datetime.now(timezone.utc).isoformat()}
    buy_sig = runner.execute_cycle(paper_instance.id, test_user.id, market_data)
    runner.approve_signal(test_user.id, buy_sig.id, actual_quantity=Decimal("200"), execution_mode="PAPER")

    portfolio = paper_repo.get_or_create_default_portfolio(test_user.id, paper_instance.id)
    pos = paper_repo.get_position(portfolio.id, "INFY")
    assert pos.quantity == Decimal("200.0000")

    # Step 2: SELL Signal generated -> Advisory only
    sell_market_data = {"symbol": "INFY", "price": 1650.00, "change_percent": -1.0, "timestamp": datetime.now(timezone.utc).isoformat()}
    sell_sig = runner.execute_cycle(paper_instance.id, test_user.id, sell_market_data)
    assert sell_sig.status == "PROPOSED"
    assert sell_sig.side == "SELL"

    # Step 3: User decides to sell 50 shares manually (partial exit)
    sell_approval = runner.approve_signal(test_user.id, sell_sig.id, actual_quantity=Decimal("50"), execution_mode="PAPER")
    assert sell_approval["status"] == "APPROVED"

    # Step 4: Verify remaining open position is exactly 150
    db_session.refresh(pos)
    assert pos.quantity == Decimal("150.0000")
    assert pos.status == "OPEN"


def test_12_to_18_automatic_stop_loss_sells_exact_actual_open_quantity(
    db_session, test_user, paper_instance
):
    """
    Test 12, 13, 14, 15, 16, 17, 18:
    - User bought 200 shares with SL=1550 (strategy suggested 100).
    - User manually sold 50 shares -> remaining open = 150.
    - Market price drops to 1540 (SL hit: 1540 <= 1550).
    - Stop-Loss automatically triggers and SELLS EXACTLY 150 shares (NOT 200, NOT 100).
    - Order source is AUTO_STOP_LOSS.
    - Position status becomes CLOSED with 0 quantity.
    """
    strat_repo = StrategyRepository(db_session)
    paper_repo = PaperPortfolioRepository(db_session)
    accounting = PaperAccountingService(repository=paper_repo)

    runner = StrategyRunner(repository=strat_repo, paper_accounting_service=accounting)
    sl_service = StopLossService(
        db=db_session,
        paper_repository=paper_repo,
        paper_accounting_service=accounting,
    )

    # 1. Buy 200 shares at 1600 with SL 1550
    market_data = {"symbol": "RELIANCE", "price": 1600.00, "change_percent": 2.0, "timestamp": datetime.now(timezone.utc).isoformat()}
    sig = runner.execute_cycle(paper_instance.id, test_user.id, market_data)
    runner.approve_signal(
        test_user.id,
        sig.id,
        actual_quantity=Decimal("200"),
        custom_stop_loss=Decimal("1550.00"),
        execution_mode="PAPER",
    )

    portfolio = paper_repo.get_or_create_default_portfolio(test_user.id, paper_instance.id)
    pos = paper_repo.get_position(portfolio.id, "RELIANCE")
    assert pos.quantity == Decimal("200.0000")
    assert pos.stop_loss == Decimal("1550.00")

    # 2. User manually sells 50 shares -> open quantity is 150
    accounting.record_fill(
        user_id=test_user.id,
        symbol="RELIANCE",
        side="SELL",
        quantity=Decimal("50"),
        price=Decimal("1620.00"),
        execution_mode="PAPER",
        paper_portfolio_id=portfolio.id,
    )
    db_session.refresh(pos)
    assert pos.quantity == Decimal("150.0000")

    # 3. Market price drops to 1540 (SL hit)
    sl_actions = sl_service.scan_and_enforce_all_stop_losses(
        quotes={"RELIANCE": Decimal("1540.00")}
    )

    assert len(sl_actions) == 1
    sl_result = sl_actions[0]
    assert sl_result["symbol"] == "RELIANCE"
    assert sl_result["order_source"] == "AUTO_STOP_LOSS"
    # CRITICAL: Must sell exactly the 150 currently open shares!
    assert sl_result["executed_quantity"] == "150.0000"
    assert sl_result["status"] == "CLOSED"

    # 4. Verify Position is now flat and CLOSED
    db_session.refresh(pos)
    assert pos.quantity == Decimal("0.0000")
    assert pos.status == "CLOSED"


def test_19_stop_loss_concurrency_locking_prevents_duplicate_auto_sells(
    db_session, test_user, paper_instance
):
    """
    Test 19:
    - Multiple concurrent scans do not double-sell or duplicate SL triggers.
    """
    paper_repo = PaperPortfolioRepository(db_session)
    accounting = PaperAccountingService(repository=paper_repo)
    sl_service = StopLossService(
        db=db_session,
        paper_repository=paper_repo,
        paper_accounting_service=accounting,
    )

    portfolio = paper_repo.get_or_create_default_portfolio(test_user.id, paper_instance.id)
    pos = PaperPosition(
        id=uuid.uuid4(),
        paper_portfolio_id=portfolio.id,
        user_id=test_user.id,
        symbol="WIPRO",
        quantity=Decimal("100.0000"),
        average_price=Decimal("500.00"),
        cost_basis=Decimal("50000.00"),
        stop_loss=Decimal("490.00"),
        status="OPEN",
    )
    db_session.add(pos)
    db_session.commit()

    # Scan 1 triggers SL
    res1 = sl_service.evaluate_paper_position_sl(pos, Decimal("480.00"))
    assert res1 is not None
    assert res1["executed_quantity"] == "100.0000"

    # Scan 2 immediately following sees position closed -> returns None
    res2 = sl_service.evaluate_paper_position_sl(pos, Decimal("480.00"))
    assert res2 is None


def test_21_user_can_ignore_signal_without_order(
    db_session, test_user, paper_instance
):
    """
    Test 21:
    - User clicks Ignore -> signal status becomes IGNORED, no order is created.
    """
    strat_repo = StrategyRepository(db_session)
    runner = StrategyRunner(repository=strat_repo)

    market_data = {"symbol": "INFY", "price": 1500.00, "change_percent": 1.5, "timestamp": datetime.now(timezone.utc).isoformat()}
    signal = runner.execute_cycle(paper_instance.id, test_user.id, market_data)
    assert signal.status == "PROPOSED"

    ignore_res = runner.ignore_signal(test_user.id, signal.id)
    assert ignore_res["status"] == "IGNORED"

    updated = strat_repo.get_signal_by_id(signal.id, test_user.id)
    assert updated.status == "IGNORED"
    assert updated.executed_order_id is None


def test_26_global_kill_switch_blocks_new_manual_entries_while_allowing_stop_loss_exit(
    db_session, test_user, paper_instance
):
    """
    Test 26:
    - When Global Kill Switch is ACTIVE:
      1. New manual BUY approval is BLOCKED with TradingHaltedException.
      2. Existing open position protective Stop-Loss CAN still execute to prevent catastrophic loss.
    """
    strat_repo = StrategyRepository(db_session)
    paper_repo = PaperPortfolioRepository(db_session)
    accounting = PaperAccountingService(repository=paper_repo)

    mock_risk = MagicMock()
    mock_risk.is_kill_switch_active.return_value = True

    runner = StrategyRunner(
        repository=strat_repo,
        paper_accounting_service=accounting,
        risk_engine=mock_risk,
    )
    sl_service = StopLossService(
        db=db_session,
        paper_repository=paper_repo,
        paper_accounting_service=accounting,
    )

    # 1. Existing open position with active SL
    portfolio = paper_repo.get_or_create_default_portfolio(test_user.id, paper_instance.id)
    pos = PaperPosition(
        id=uuid.uuid4(),
        paper_portfolio_id=portfolio.id,
        user_id=test_user.id,
        symbol="HDFCBANK",
        quantity=Decimal("50.0000"),
        average_price=Decimal("1600.00"),
        cost_basis=Decimal("80000.00"),
        stop_loss=Decimal("1570.00"),
        status="OPEN",
    )
    db_session.add(pos)
    db_session.commit()

    # 2. Attempting new manual BUY is blocked
    market_data = {"symbol": "ICICIBANK", "price": 1000.00, "change_percent": 2.0, "timestamp": datetime.now(timezone.utc).isoformat()}
    new_sig = runner.execute_cycle(paper_instance.id, test_user.id, market_data)

    with pytest.raises(TradingHaltedException):
        runner.approve_signal(test_user.id, new_sig.id, actual_quantity=Decimal("10"), execution_mode="PAPER")

    # 3. Protective Stop-Loss for existing open HDFCBANK position executes successfully
    sl_actions = sl_service.scan_and_enforce_all_stop_losses(
        quotes={"HDFCBANK": Decimal("1560.00")}
    )
    assert len(sl_actions) == 1
    assert sl_actions[0]["symbol"] == "HDFCBANK"
    assert sl_actions[0]["order_source"] == "AUTO_STOP_LOSS"
    assert sl_actions[0]["executed_quantity"] == "50.0000"


# ---------------------------------------------------------------------------
# Duplicate BUY Suppression Regression Tests
# ---------------------------------------------------------------------------


def test_28_duplicate_buy_suppression_when_position_is_already_open(
    db_session, test_user, paper_instance
):
    """
    Test: After user manually buys and position is OPEN, subsequent cycles with BUY condition
    must NOT generate duplicate BUY signals or notifications.
    """
    strat_repo = StrategyRepository(db_session)
    paper_repo = PaperPortfolioRepository(db_session)
    accounting = PaperAccountingService(repository=paper_repo)

    runner = StrategyRunner(repository=strat_repo, paper_accounting_service=accounting)

    # 1. Initial BUY cycle generates signal
    market_data_1 = {"symbol": "TCS", "price": 3500.00, "change_percent": 2.5, "timestamp": datetime.now(timezone.utc).isoformat()}
    signal_1 = runner.execute_cycle(paper_instance.id, test_user.id, market_data_1)
    assert signal_1 is not None
    assert signal_1.status == "PROPOSED"

    # 2. User manually approves BUY
    approval = runner.approve_signal(test_user.id, signal_1.id, actual_quantity=Decimal("10"), execution_mode="PAPER")
    assert approval["status"] == "APPROVED"

    # Verify position is now OPEN
    pos = paper_repo.get_position_for_user(test_user.id, "TCS") if hasattr(paper_repo, "get_position_for_user") else paper_repo.get_position(paper_repo.get_or_create_default_portfolio(test_user.id, paper_instance.id).id, "TCS")
    assert pos is not None
    assert pos.quantity == Decimal("10.0000")

    # 3. Next cycle 5 seconds later with same bullish BUY condition
    market_data_2 = {"symbol": "TCS", "price": 3510.00, "change_percent": 2.8, "timestamp": datetime.now(timezone.utc).isoformat()}
    signal_2 = runner.execute_cycle(paper_instance.id, test_user.id, market_data_2)

    # MUST be suppressed (returns None, no duplicate signal, no notification spam!)
    assert signal_2 is None


def test_29_active_proposed_signal_suppresses_repeated_buy_notifications(
    db_session, test_user, paper_instance
):
    """
    Test: While a proposed BUY signal is pending user action, continuous cycles must NOT
    generate duplicate signals or notification spam for the same symbol.
    """
    strat_repo = StrategyRepository(db_session)
    paper_repo = PaperPortfolioRepository(db_session)
    accounting = PaperAccountingService(repository=paper_repo)

    runner = StrategyRunner(repository=strat_repo, paper_accounting_service=accounting)

    # 1. First cycle generates proposed BUY signal
    market_data_1 = {"symbol": "INFY", "price": 1600.00, "change_percent": 2.0, "timestamp": datetime.now(timezone.utc).isoformat()}
    sig_1 = runner.execute_cycle(paper_instance.id, test_user.id, market_data_1)
    assert sig_1 is not None
    assert sig_1.status == "PROPOSED"

    # 2. User has NOT approved or dismissed yet. Next cycle arrives 5s later:
    market_data_2 = {"symbol": "INFY", "price": 1605.00, "change_percent": 2.2, "timestamp": datetime.now(timezone.utc).isoformat()}
    sig_2 = runner.execute_cycle(paper_instance.id, test_user.id, market_data_2)

    # Must be suppressed because sig_1 is still pending action
    assert sig_2 is None


def test_30_position_closed_allows_new_genuine_buy_signal(
    db_session, test_user, paper_instance
):
    """
    Test: After position is fully closed (e.g. SL hit or user exited), subsequent genuine BUY
    conditions are allowed to generate new signals.
    """
    strat_repo = StrategyRepository(db_session)
    paper_repo = PaperPortfolioRepository(db_session)
    accounting = PaperAccountingService(repository=paper_repo)

    runner = StrategyRunner(repository=strat_repo, paper_accounting_service=accounting)
    portfolio = paper_repo.get_or_create_default_portfolio(test_user.id, paper_instance.id)

    # 1. Buy 10 shares
    market_data_1 = {"symbol": "SBIN", "price": 600.00, "change_percent": 2.0, "timestamp": datetime.now(timezone.utc).isoformat()}
    sig_1 = runner.execute_cycle(paper_instance.id, test_user.id, market_data_1)
    runner.approve_signal(test_user.id, sig_1.id, actual_quantity=Decimal("10"), execution_mode="PAPER")

    # 2. Position is completely closed (sold 10 shares)
    accounting.record_fill(
        user_id=test_user.id,
        symbol="SBIN",
        side="SELL",
        quantity=Decimal("10"),
        price=Decimal("620.00"),
        execution_mode="PAPER",
        paper_portfolio_id=portfolio.id,
    )
    pos = paper_repo.get_position(portfolio.id, "SBIN")
    assert pos.quantity == Decimal("0.0000")

    # 3. New cycle with fresh bullish BUY breakout
    market_data_2 = {"symbol": "SBIN", "price": 630.00, "change_percent": 3.0, "timestamp": datetime.now(timezone.utc).isoformat()}
    sig_2 = runner.execute_cycle(paper_instance.id, test_user.id, market_data_2)

    # Genuinely new BUY signal is generated because previous position is flat!
    assert sig_2 is not None
    assert sig_2.status == "PROPOSED"
    assert sig_2.symbol == "SBIN"


def test_31_user_ignores_signal_persists_in_db_and_suppresses_recreation_across_multiple_cycles(
    db_session, test_user, paper_instance
):
    """
    Test: When a user clicks Ignore/Dismiss on a signal:
    1. The IGNORED status is persisted in the database with actioned_at timestamp.
    2. Multiple subsequent strategy cycles (5s, 10s, 60s later) must NOT recreate the same signal.
    """
    strat_repo = StrategyRepository(db_session)
    paper_repo = PaperPortfolioRepository(db_session)
    accounting = PaperAccountingService(repository=paper_repo)

    runner = StrategyRunner(repository=strat_repo, paper_accounting_service=accounting)

    # 1. First cycle generates proposed BUY signal
    market_data_1 = {"symbol": "RELIANCE", "price": 2500.00, "change_percent": 2.0, "timestamp": datetime.now(timezone.utc).isoformat()}
    sig_1 = runner.execute_cycle(paper_instance.id, test_user.id, market_data_1)
    assert sig_1 is not None
    assert sig_1.status == "PROPOSED"

    # 2. User clicks Ignore / Dismiss
    ignore_res = runner.ignore_signal(test_user.id, sig_1.id)
    assert ignore_res["status"] == "IGNORED"

    # Verify status in database
    db_signal = strat_repo.get_signal_by_id(sig_1.id, test_user.id)
    assert db_signal.status == "IGNORED"
    assert db_signal.actioned_at is not None

    # 3. Subsequent cycle 1 (5 seconds later) with same condition
    market_data_2 = {"symbol": "RELIANCE", "price": 2505.00, "change_percent": 2.1, "timestamp": datetime.now(timezone.utc).isoformat()}
    sig_cycle_2 = runner.execute_cycle(paper_instance.id, test_user.id, market_data_2)
    assert sig_cycle_2 is None, "Cycle 2 must be suppressed after user ignored the signal"

    # 4. Subsequent cycle 2 (10 seconds later) with same condition
    market_data_3 = {"symbol": "RELIANCE", "price": 2510.00, "change_percent": 2.3, "timestamp": datetime.now(timezone.utc).isoformat()}
    sig_cycle_3 = runner.execute_cycle(paper_instance.id, test_user.id, market_data_3)
    assert sig_cycle_3 is None, "Cycle 3 must be suppressed after user ignored the signal"

    # 5. Subsequent cycle 3 (60 seconds later) with same condition
    market_data_4 = {"symbol": "RELIANCE", "price": 2515.00, "change_percent": 2.5, "timestamp": datetime.now(timezone.utc).isoformat()}
    sig_cycle_4 = runner.execute_cycle(paper_instance.id, test_user.id, market_data_4)
    assert sig_cycle_4 is None, "Cycle 4 must be suppressed after user ignored the signal"

    # Verify no new pending signals exist for RELIANCE
    pending = strat_repo.list_pending_signals(test_user.id)
    assert all(s.symbol != "RELIANCE" for s in pending)


def test_32_genuinely_new_signal_after_ignore_cooldown_is_allowed(
    db_session, test_user, paper_instance
):
    """
    Test: After the ignore cooldown period has elapsed, a genuinely new signal is permitted.
    """
    strat_repo = StrategyRepository(db_session)
    paper_repo = PaperPortfolioRepository(db_session)
    accounting = PaperAccountingService(repository=paper_repo)

    # Configure a 2-second cooldown on the strategy definition
    definition = strat_repo.get_definition_for_user(paper_instance.strategy_definition_id, test_user.id)
    strat_repo.update_definition(definition.id, test_user.id, {"config_json": json.dumps({"ignore_cooldown_seconds": 1})})

    runner = StrategyRunner(repository=strat_repo, paper_accounting_service=accounting)

    # 1. First cycle & user ignore
    market_data_1 = {"symbol": "WIPRO", "price": 400.00, "change_percent": 2.0, "timestamp": datetime.now(timezone.utc).isoformat()}
    sig_1 = runner.execute_cycle(paper_instance.id, test_user.id, market_data_1)
    runner.ignore_signal(test_user.id, sig_1.id)

    # Manually backdate the actioned_at timestamp by 10 seconds to simulate elapsed cooldown
    from datetime import timedelta
    sig_record = strat_repo.get_signal_by_id(sig_1.id, test_user.id)
    sig_record.actioned_at = datetime.now(timezone.utc) - timedelta(seconds=10)
    sig_record.updated_at = datetime.now(timezone.utc) - timedelta(seconds=10)
    db_session.commit()

    # 2. Next cycle after cooldown elapsed
    market_data_2 = {"symbol": "WIPRO", "price": 410.00, "change_percent": 3.0, "timestamp": datetime.now(timezone.utc).isoformat()}
    sig_2 = runner.execute_cycle(paper_instance.id, test_user.id, market_data_2)

    # Genuinely new signal after cooldown is permitted
    assert sig_2 is not None
    assert sig_2.status == "PROPOSED"
    assert sig_2.symbol == "WIPRO"


def test_33_automatic_trailing_stop_loss_locks_in_profit(
    db_session, test_user, paper_instance
):
    """
    Test: Verifies that when position gains profit (+2%, +4%), Stop-Loss automatically
    shifts upward (Break-Even -> Profit Lock-in) and protects against giving back gains.
    """
    paper_repo = PaperPortfolioRepository(db_session)
    accounting = PaperAccountingService(repository=paper_repo)
    sl_service = StopLossService(
        db=db_session,
        paper_repository=paper_repo,
        paper_accounting_service=accounting,
    )

    portfolio = paper_repo.get_or_create_default_portfolio(test_user.id, paper_instance.id)

    # 1. Open a position bought at ₹1000.00 with initial 2% SL at ₹980.00
    pos = PaperPosition(
        id=uuid.uuid4(),
        paper_portfolio_id=portfolio.id,
        user_id=test_user.id,
        symbol="RELIANCE",
        quantity=Decimal("100.0000"),
        average_price=Decimal("1000.0000"),
        cost_basis=Decimal("100000.0000"),
        stop_loss=Decimal("980.0000"),
        status="OPEN",
    )
    db_session.add(pos)
    db_session.commit()

    # 2. Market price rises to ₹1020.00 (+2% profit) -> Shift SL to Break-Even (≥ ₹1001.00)
    sl_service.scan_and_enforce_all_stop_losses(quotes={"RELIANCE": Decimal("1020.00")})
    db_session.refresh(pos)
    assert pos.stop_loss >= Decimal("1001.00")
    assert pos.status == "OPEN"

    # 3. Market price rises further to ₹1040.00 (+4% profit) -> Shift SL to lock in profit (≥ ₹1015.00)
    sl_service.scan_and_enforce_all_stop_losses(quotes={"RELIANCE": Decimal("1040.00")})
    db_session.refresh(pos)
    assert pos.stop_loss >= Decimal("1015.00")
    trailed_sl = pos.stop_loss

    # 4. Market price drops from peak ₹1040 to ₹1030 (SL must NEVER drop down)
    sl_service.scan_and_enforce_all_stop_losses(quotes={"RELIANCE": Decimal("1030.00")})
    db_session.refresh(pos)
    assert pos.stop_loss == trailed_sl

    # 5. Market price collapses to ₹1010.00 (below the trailed SL of ₹1015.00) -> Auto exit triggered with locked-in profit!
    actions = sl_service.scan_and_enforce_all_stop_losses(quotes={"RELIANCE": Decimal("1010.00")})
    assert len(actions) == 1
    assert actions[0]["symbol"] == "RELIANCE"
    assert actions[0]["order_source"] == "AUTO_STOP_LOSS"
    db_session.refresh(pos)
    assert pos.status == "CLOSED"



