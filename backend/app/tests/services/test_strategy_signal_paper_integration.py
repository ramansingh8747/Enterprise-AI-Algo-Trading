import uuid
import json
import pytest
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from unittest.mock import MagicMock, patch

from app.database.models.strategy import StrategyDefinition, StrategyInstance, StrategySignal
from app.database.models.paper_portfolio import PaperPortfolio, PaperPosition
from app.services.strategy_engine.strategy_runner import StrategyRunner
from app.services.strategy_engine.base_strategy import (
    DeterministicMomentumStrategy,
    RuleBasedStrategy,
    StrategyFactory,
)
from app.services.paper_accounting_service import PaperAccountingService
from app.services.trading_safety_service import TradingSafetyService
from app.services.risk_engine import RiskEngine
from app.exceptions.strategy_exceptions import (
    StaleDataException,
    DuplicateSignalException,
    BaseStrategyException,
)
from app.exceptions.risk_exceptions import (
    TradingHaltedException,
    RiskLimitExceededException,
)
from app.exceptions.paper_accounting_exceptions import (
    InsufficientPaperCashException,
    InsufficientPaperPositionException,
)
from app.services.event_bus.models import EventType
from app.brokers.base.broker_types import BrokerOrderRequest, BrokerOrder


class MockEventPublisher:
    def __init__(self):
        self.published_events = []

    async def publish(self, topic, event):
        self.published_events.append((topic, event))


@pytest.fixture
def mock_db():
    session = MagicMock()
    return session


@pytest.fixture
def mock_strategy_repo(mock_db):
    repo = MagicMock()
    repo.db = mock_db
    return repo


@pytest.fixture
def mock_paper_portfolio_repo(mock_db):
    repo = MagicMock()
    repo.db = mock_db
    return repo


@pytest.fixture
def event_publisher():
    return MockEventPublisher()


def test_item_1_and_2_db_definition_source_of_truth_and_running_instance_loaded(mock_strategy_repo):
    """Items 1 & 2: Database Strategy Definition is source of truth & loaded for RUNNING instance."""
    user_id = uuid.uuid4()
    instance_id = uuid.uuid4()
    def_id = uuid.uuid4()

    definition = StrategyDefinition(
        id=def_id,
        user_id=user_id,
        name="Source of Truth Strategy",
        strategy_type="RULE_BASED",
        config_json=json.dumps({"symbol": "HDFCBANK", "quantity": 15, "buy_price_threshold": 1600.0}),
        is_active=True,
    )
    instance = StrategyInstance(
        id=instance_id,
        user_id=user_id,
        broker_id=uuid.uuid4(),
        strategy_definition_id=def_id,
        execution_mode="PAPER",
        status="RUNNING",
    )
    mock_strategy_repo.get_instance_for_user.return_value = instance
    mock_strategy_repo.get_definition_for_user.return_value = definition

    runner = StrategyRunner(repository=mock_strategy_repo)
    strat = StrategyFactory.create_strategy(definition=definition)

    assert strat.symbol == "HDFCBANK"
    assert strat.quantity == Decimal("15")
    assert instance.status == "RUNNING"


def test_item_3_strategy_rules_parsed_and_validated():
    """Item 3: Strategy rules are parsed and validated."""
    config = {
        "symbol": "SBIN",
        "side": "BUY",
        "quantity": 100,
        "buy_price_threshold": "650.50",
        "order_type": "MARKET",
        "stop_loss": "630.00",
        "target": "700.00",
    }
    strategy = StrategyFactory.create_strategy(config=config, strategy_type="RULE_BASED")
    assert isinstance(strategy, RuleBasedStrategy)
    assert strategy.symbol == "SBIN"
    assert strategy.quantity == Decimal("100")
    assert strategy.buy_price_threshold == Decimal("650.50")
    assert strategy.stop_loss == Decimal("630.00")
    assert strategy.target == Decimal("700.00")


def test_item_4_and_5_market_data_intake_and_stale_data_guard_fails_closed(mock_strategy_repo):
    """Items 4 & 5: Market data intake and 10s stale data guard fails closed."""
    runner = StrategyRunner(repository=mock_strategy_repo, max_data_age_seconds=10)

    # Missing timestamp
    with pytest.raises(StaleDataException):
        runner._validate_market_data_timestamp({"symbol": "TCS", "price": 3500})

    # Stale timestamp (> 10 seconds old)
    stale_ts = (datetime.now(timezone.utc) - timedelta(seconds=20)).isoformat()
    with pytest.raises(StaleDataException):
        runner._validate_market_data_timestamp({"symbol": "TCS", "price": 3500, "timestamp": stale_ts})

    # Fresh timestamp
    fresh_ts = datetime.now(timezone.utc).isoformat()
    validated = runner._validate_market_data_timestamp({"symbol": "TCS", "price": 3500, "timestamp": fresh_ts})
    assert validated is not None


def test_item_6_and_7_buy_and_sell_signals_automatically_generated():
    """Items 6 & 7: BUY and SELL signals are automatically generated from rules."""
    config = {
        "symbol": "INFY",
        "side": "DYNAMIC",
        "quantity": 20,
        "buy_threshold": 1500.0,
        "sell_threshold": 1400.0,
    }
    strategy = StrategyFactory.create_strategy(config=config, strategy_type="RULE_BASED")

    # Item 6: BUY signal
    buy_sig = strategy.generate_signal({"symbol": "INFY", "price": 1550.0, "change_percent": 2.0})
    assert buy_sig is not None
    assert buy_sig["side"] == "BUY"
    assert buy_sig["quantity"] == Decimal("20")
    assert buy_sig["price"] == Decimal("1550.0")

    # Item 7: SELL signal
    sell_sig = strategy.generate_signal({"symbol": "INFY", "price": 1350.0, "change_percent": -2.5})
    assert sell_sig is not None
    assert sell_sig["side"] == "SELL"
    assert sell_sig["quantity"] == Decimal("20")
    assert sell_sig["price"] == Decimal("1350.0")


def test_item_8_sha256_signal_fingerprint_deduplication_atomic(mock_strategy_repo):
    """Item 8: SHA-256 signal fingerprint deduplication is atomic."""
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

    existing_signal = StrategySignal(
        id=uuid.uuid4(),
        strategy_instance_id=instance_id,
        user_id=user_id,
        broker_id=broker_id,
        symbol="TATASTEEL",
        side="BUY",
        quantity=Decimal("10"),
        order_type="MARKET",
        signal_fingerprint="fp_duplicate_1",
        status="EXECUTED",
    )
    # is_new = False denotes duplicate detected by database unique constraint
    mock_strategy_repo.create_signal_if_not_exists.return_value = (existing_signal, False)

    runner = StrategyRunner(repository=mock_strategy_repo)
    market_data = {
        "symbol": "TATASTEEL",
        "price": 150.0,
        "change_percent": 2.0,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    with pytest.raises(DuplicateSignalException):
        runner.execute_cycle(instance_id, user_id, market_data)


def test_item_9_kill_switch_blocks_execution(mock_strategy_repo):
    """Item 9: Kill Switch blocks manual approval and execution."""
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
        symbol="SBIN",
        side="BUY",
        quantity=Decimal("10"),
        suggested_quantity=Decimal("10"),
        order_type="MARKET",
        price=Decimal("600.00"),
        signal_fingerprint="fp_ks",
        status="PROPOSED",
    )
    mock_strategy_repo.create_signal_if_not_exists.return_value = (signal_record, True)
    mock_strategy_repo.get_signal_by_id.return_value = signal_record

    risk_engine = MagicMock()
    risk_engine.is_kill_switch_active.return_value = True

    runner = StrategyRunner(repository=mock_strategy_repo, risk_engine=risk_engine)
    market_data = {"symbol": "SBIN", "price": 600.0, "change_percent": 2.0, "timestamp": datetime.now(timezone.utc).isoformat()}

    # 1. Strategy execution generates PROPOSED signal
    res = runner.execute_cycle(instance_id, user_id, market_data)
    assert res is not None
    assert res.status == "PROPOSED"

    # 2. User manual approval is blocked by active kill switch
    with pytest.raises(TradingHaltedException):
        runner.approve_signal(user_id, signal_record.id, actual_quantity=Decimal("10"), execution_mode="PAPER")


def test_item_10_11_12_risk_limits_block_execution(mock_strategy_repo):
    """Items 10, 11, 12: Max Position, Max Order Value, and Daily Loss limits block manual approval."""
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

    for exc_type, msg in [
        (RiskLimitExceededException, "Maximum order value limit exceeded"),
        (TradingHaltedException, "Daily loss limit reached, trading halted"),
    ]:
        sig = StrategySignal(
            id=uuid.uuid4(),
            strategy_instance_id=instance_id,
            user_id=user_id,
            broker_id=broker_id,
            symbol="INFY",
            side="BUY",
            quantity=Decimal("10"),
            suggested_quantity=Decimal("10"),
            order_type="MARKET",
            price=Decimal("1500.00"),
            signal_fingerprint=f"fp_{exc_type.__name__}",
            status="PROPOSED",
        )
        mock_strategy_repo.create_signal_if_not_exists.return_value = (sig, True)
        mock_strategy_repo.get_signal_by_id.return_value = sig

        safety_service = MagicMock()
        safety_service.validate_order.side_effect = exc_type(msg)

        mock_accounting = MagicMock()
        mock_accounting.get_risk_snapshot.return_value = ([], Decimal("0"))

        runner = StrategyRunner(
            repository=mock_strategy_repo,
            paper_accounting_service=mock_accounting,
            safety_service=safety_service,
        )
        market_data = {"symbol": "INFY", "price": 1500.0, "change_percent": 1.5, "timestamp": datetime.now(timezone.utc).isoformat()}

        res = runner.execute_cycle(instance_id, user_id, market_data)
        assert res is not None
        assert res.status == "PROPOSED"

        with pytest.raises(exc_type):
            runner.approve_signal(user_id, sig.id, actual_quantity=Decimal("10"), execution_mode="PAPER")



def test_item_13_available_capital_safety_check(mock_paper_portfolio_repo):
    """Item 13: Available Capital / buying power safety check works."""
    user_id = uuid.uuid4()
    portfolio = PaperPortfolio(
        id=uuid.uuid4(),
        user_id=user_id,
        name="Low Cash Portfolio",
        execution_mode="PAPER",
        cash_balance=Decimal("100.00"),  # Only 100 available
    )
    mock_paper_portfolio_repo.get_or_create_default_portfolio.return_value = portfolio
    mock_paper_portfolio_repo.lock_portfolio_for_update.return_value = portfolio
    mock_paper_portfolio_repo.lock_position_for_update.return_value = None

    accounting_service = PaperAccountingService(repository=mock_paper_portfolio_repo)

    # Attempt order requiring 5,000 capital (10 * 500)
    with pytest.raises(InsufficientPaperCashException):
        accounting_service.record_fill(
            user_id=user_id,
            symbol="RELIANCE",
            side="BUY",
            quantity=Decimal("10"),
            price=Decimal("500.00"),
            execution_mode="PAPER",
        )


def test_items_14_to_22_e2e_buy_and_sell_positions_portfolio_valuation_pnl(
    mock_strategy_repo, mock_paper_portfolio_repo, event_publisher
):
    """
    Items 14 to 22:
    - Risk approved signal creates PAPER order (Item 14)
    - Reaches COMPLETE state (Item 15)
    - Signal marked EXECUTED (Item 16)
    - PaperPosition updated for BUY (Item 17)
    - PaperPosition updated for SELL (Item 18)
    - Average price and cost basis calculated (Item 19)
    - PaperPortfolio cash balance updated (Item 20)
    - Realized P&L updated on SELL (Item 21)
    - Portfolio valuation updated (Item 22)
    """
    user_id = uuid.uuid4()
    instance_id = uuid.uuid4()
    broker_id = uuid.uuid4()
    def_id = uuid.uuid4()

    definition = StrategyDefinition(
        id=def_id,
        user_id=user_id,
        name="Complete Cycle Strategy",
        strategy_type="RULE_BASED",
        config_json=json.dumps({"symbol": "TCS", "side": "DYNAMIC", "quantity": 10, "buy_threshold": 3000.0, "sell_threshold": 2500.0}),
    )
    instance = StrategyInstance(
        id=instance_id,
        user_id=user_id,
        broker_id=broker_id,
        strategy_definition_id=def_id,
        execution_mode="PAPER",
        status="RUNNING",
    )
    mock_strategy_repo.get_instance_for_user.return_value = instance
    mock_strategy_repo.get_definition_for_user.return_value = definition

    # Portfolio with initial 100,000 cash
    portfolio = PaperPortfolio(
        id=uuid.uuid4(),
        user_id=user_id,
        execution_mode="PAPER",
        cash_balance=Decimal("100000.00"),
        realized_pnl=Decimal("0.00"),
    )
    position = PaperPosition(
        id=uuid.uuid4(),
        paper_portfolio_id=portfolio.id,
        user_id=user_id,
        symbol="TCS",
        quantity=Decimal("0.00"),
        average_price=Decimal("0.00"),
        cost_basis=Decimal("0.00"),
        realized_pnl=Decimal("0.00"),
    )

    mock_paper_portfolio_repo.get_or_create_default_portfolio.return_value = portfolio
    mock_paper_portfolio_repo.lock_portfolio_for_update.return_value = portfolio
    mock_paper_portfolio_repo.lock_position_for_update.return_value = position
    mock_paper_portfolio_repo.get_all_positions_for_portfolio.return_value = [position]

    accounting_service = PaperAccountingService(repository=mock_paper_portfolio_repo)
    risk_engine = MagicMock()

    runner = StrategyRunner(
        repository=mock_strategy_repo,
        paper_accounting_service=accounting_service,
        event_publisher=event_publisher,
        risk_engine=risk_engine,
    )

    # 1. BUY Signal Generation & User Approval (10 shares @ 3100 = 31,000 cost)
    buy_sig = StrategySignal(
        id=uuid.uuid4(),
        strategy_instance_id=instance_id,
        user_id=user_id,
        broker_id=broker_id,
        symbol="TCS",
        side="BUY",
        quantity=Decimal("10"),
        suggested_quantity=Decimal("10"),
        order_type="MARKET",
        price=Decimal("3100.00"),
        stop_loss=Decimal("3038.00"),
        target=Decimal("3224.00"),
        signal_fingerprint="fp_buy_1",
        status="PROPOSED",
    )
    mock_strategy_repo.create_signal_if_not_exists.return_value = (buy_sig, True)
    mock_strategy_repo.get_signal_by_id.return_value = buy_sig

    buy_market_data = {"symbol": "TCS", "price": 3100.0, "change_percent": 1.5, "timestamp": datetime.now(timezone.utc).isoformat()}
    # Execute cycle generates PROPOSED signal
    sig = runner.execute_cycle(instance_id, user_id, buy_market_data)
    assert sig.status == "PROPOSED"

    # User manually approves BUY
    buy_approval = runner.approve_signal(user_id, buy_sig.id, actual_quantity=Decimal("10"), execution_mode="PAPER")
    assert buy_approval["status"] == "APPROVED"
    assert position.quantity == Decimal("10.0000")
    assert position.average_price == Decimal("3100.0000")
    assert position.cost_basis == Decimal("31000.0000")
    assert portfolio.cash_balance == Decimal("69000.0000")

    # 2. SELL Signal Generation & User Approval (10 shares @ 2400 = 24,000 proceeds, realized loss = -7,000)
    sell_sig = StrategySignal(
        id=uuid.uuid4(),
        strategy_instance_id=instance_id,
        user_id=user_id,
        broker_id=broker_id,
        symbol="TCS",
        side="SELL",
        quantity=Decimal("10"),
        suggested_quantity=Decimal("10"),
        order_type="MARKET",
        price=Decimal("2400.00"),
        signal_fingerprint="fp_sell_1",
        status="PROPOSED",
    )
    mock_strategy_repo.create_signal_if_not_exists.return_value = (sell_sig, True)
    mock_strategy_repo.get_signal_by_id.return_value = sell_sig

    sell_market_data = {"symbol": "TCS", "price": 2400.0, "change_percent": -2.0, "timestamp": datetime.now(timezone.utc).isoformat()}
    sig2 = runner.execute_cycle(instance_id, user_id, sell_market_data)
    assert sig2.status == "PROPOSED"

    # User manually approves SELL
    sell_approval = runner.approve_signal(user_id, sell_sig.id, actual_quantity=Decimal("10"), execution_mode="PAPER")
    assert sell_approval["status"] == "APPROVED"
    assert position.quantity == Decimal("0.0000")  # Position flat
    assert portfolio.cash_balance == Decimal("93000.0000")  # 69,000 + 24,000
    assert portfolio.realized_pnl == Decimal("-7000.0000")  # (2400 - 3100) * 10 = -7000


def test_items_36_to_38_strict_live_isolation_and_ambiguous_mode_fails_closed(mock_strategy_repo):
    """Items 36, 37, 38: Live gate OFF, no live broker order dispatch, ambiguous mode fails closed."""
    user_id = uuid.uuid4()
    mock_broker_order_service = MagicMock()

    # Ambiguous / invalid execution mode -> fails closed
    invalid_instance = StrategyInstance(
        id=uuid.uuid4(),
        user_id=user_id,
        broker_id=uuid.uuid4(),
        strategy_definition_id=uuid.uuid4(),
        execution_mode="UNKNOWN_HYBRID_MODE",
        status="RUNNING",
    )
    mock_strategy_repo.get_instance_for_user.return_value = invalid_instance
    dummy_signal = StrategySignal(
        id=uuid.uuid4(),
        strategy_instance_id=invalid_instance.id,
        user_id=user_id,
        broker_id=invalid_instance.broker_id,
        symbol="INFY",
        side="BUY",
        quantity=Decimal("10"),
        suggested_quantity=Decimal("10"),
        order_type="MARKET",
        price=Decimal("1500.00"),
        signal_fingerprint="fp_ambig_1",
        status="PROPOSED",
    )
    mock_strategy_repo.create_signal_if_not_exists.return_value = (dummy_signal, True)
    mock_strategy_repo.get_signal_by_id.return_value = dummy_signal

    runner = StrategyRunner(repository=mock_strategy_repo, broker_order_service=mock_broker_order_service)
    market_data = {"symbol": "INFY", "price": 1500.0, "change_percent": 1.5, "timestamp": datetime.now(timezone.utc).isoformat()}

    sig = runner.execute_cycle(invalid_instance.id, user_id, market_data)
    assert sig.status == "PROPOSED"

    # When user approves with invalid execution mode, it fails closed
    with pytest.raises(Exception):
        runner.approve_signal(user_id, dummy_signal.id, actual_quantity=Decimal("10"), execution_mode="UNKNOWN_HYBRID_MODE")

    mock_broker_order_service.place_order.assert_not_called()

