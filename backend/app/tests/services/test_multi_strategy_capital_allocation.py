import uuid
from decimal import Decimal
from datetime import datetime, timezone
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.models.user import User, UserRole
from app.database.models.broker import Broker
from app.database.models.strategy import StrategyDefinition, StrategyInstance
from app.database.models.paper_portfolio import PaperPortfolio, PaperPosition
from app.database.models.trading_risk_settings import TradingRiskSettings
from app.database.repositories.paper_portfolio_repository import PaperPortfolioRepository
from app.database.repositories.trading_risk_repository import TradingRiskRepository
from app.services.paper_accounting_service import PaperAccountingService
from app.services.risk_engine import RiskEngine
from app.services.trading_safety_service import TradingSafetyService
from app.exceptions.risk_exceptions import RiskLimitExceededException
from app.brokers.base.broker_types import BrokerOrderRequest

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


def test_multi_strategy_same_symbol_capital_allocation_and_exposure_blocking(db_session):
    """
    Regression Test:
    - 3 distinct strategies have isolated capital buckets (Rs 2,50,000 each).
    - Portfolio-level single-stock limit on RELIANCE is 100 shares.
    - Candle 1: All 3 strategies attempt to BUY RELIANCE on the same candle @ Rs 1300.
      - Strategy 1 requests 50 shares -> Accepted (Exposure = 50).
      - Strategy 2 requests 50 shares -> Accepted (Exposure = 100).
      - Strategy 3 requests 40 shares -> BLOCKED with RiskLimitExceededException (Projected = 140 > 100).
    - Candle 2: Take-profit exit @ Rs 1365.
      - Strategy 1 sells 50 shares -> Realized P&L > 0.
      - Strategy 2 sells 50 shares -> Realized P&L > 0.
      - Strategy 3 has zero shares and untouched capital.
    - Consolidated portfolio aggregates P&L accurately.
    """
    user = User(
        id=uuid.uuid4(),
        email=f"multi_strat_{uuid.uuid4().hex[:6]}@test.com",
        username=f"user_{uuid.uuid4().hex[:6]}",
        password_hash="mock_hash",
        full_name="Multi Strategy Tester",
        role=UserRole.TRADER,
        is_active=True,
    )
    db_session.add(user)

    broker = Broker(
        id=uuid.uuid4(),
        broker_name="Multi Broker Test",
        broker_type="ZERODHA",
        api_key="k",
        api_secret="s",
        is_active=True,
    )
    db_session.add(broker)
    db_session.flush()

    # 1. Create 3 Strategies with Rs 2,50,000 bucket each
    allocated_bucket = Decimal("250000.00")
    instances = []
    portfolios = []

    for i in range(1, 4):
        defn = StrategyDefinition(
            id=uuid.uuid4(),
            user_id=user.id,
            name=f"Reliance Strategy {i}",
            strategy_type="RULE_BASED",
            config_json='{"symbol": "RELIANCE"}',
        )
        db_session.add(defn)
        db_session.flush()

        inst = StrategyInstance(
            id=uuid.uuid4(),
            user_id=user.id,
            broker_id=broker.id,
            strategy_definition_id=defn.id,
            execution_mode="PAPER",
            status="RUNNING",
        )
        db_session.add(inst)
        db_session.flush()
        instances.append(inst)

        port = PaperPortfolio(
            id=uuid.uuid4(),
            user_id=user.id,
            strategy_instance_id=inst.id,
            name=f"Bucket - Strategy {i}",
            execution_mode="PAPER",
            initial_balance=allocated_bucket,
            cash_balance=allocated_bucket,
            realized_pnl=Decimal("0.0000"),
        )
        db_session.add(port)
        db_session.flush()
        portfolios.append(port)

    # 2. Risk Settings: Single-stock max position quantity = 100 shares
    risk_settings = TradingRiskSettings(
        id=uuid.uuid4(),
        user_id=user.id,
        broker_id=broker.id,
        max_order_quantity=Decimal("100"),
        max_order_notional=Decimal("200000.00"),
        max_position_quantity=Decimal("100"), # 100 shares single-stock limit
        max_exposure_notional=Decimal("500000.00"),
        max_orders_per_minute=30,
        daily_loss_limit=Decimal("50000.00"),
        kill_switch_active=False,
    )
    db_session.add(risk_settings)
    db_session.commit()

    paper_repo = PaperPortfolioRepository(db_session)
    risk_repo = TradingRiskRepository(db_session)
    accounting = PaperAccountingService(repository=paper_repo)
    risk_engine = RiskEngine(repository=risk_repo)
    safety_service = TradingSafetyService(risk_engine=risk_engine, session_service=None)

    candle_price = Decimal("1300.00")

    # --- Strategy 1 Execution (BUY 50 shares) ---
    snap1, exp1 = accounting.get_risk_snapshot(user.id)
    order1 = BrokerOrderRequest(
        symbol="RELIANCE", exchange="NSE", quantity=Decimal("50"), side="BUY",
        order_type="MARKET", product="CNC", variety="regular", price=candle_price,
    )
    safety_service._risk_engine.validate_order(user.id, broker.id, order1, snap1, exp1)
    accounting.record_fill(
        user_id=user.id, broker_id=broker.id, symbol="RELIANCE", side="BUY",
        quantity=Decimal("50"), price=candle_price, execution_mode="PAPER",
        paper_portfolio_id=portfolios[0].id, strategy_instance_id=instances[0].id,
        execution_id=f"EX-{uuid.uuid4().hex[:6]}", product="CNC", apply_transaction_costs=True,
    )
    db_session.commit()

    # --- Strategy 2 Execution (BUY 50 shares) ---
    snap2, exp2 = accounting.get_risk_snapshot(user.id)
    order2 = BrokerOrderRequest(
        symbol="RELIANCE", exchange="NSE", quantity=Decimal("50"), side="BUY",
        order_type="MARKET", product="CNC", variety="regular", price=candle_price,
    )
    safety_service._risk_engine.validate_order(user.id, broker.id, order2, snap2, exp2)
    accounting.record_fill(
        user_id=user.id, broker_id=broker.id, symbol="RELIANCE", side="BUY",
        quantity=Decimal("50"), price=candle_price, execution_mode="PAPER",
        paper_portfolio_id=portfolios[1].id, strategy_instance_id=instances[1].id,
        execution_id=f"EX-{uuid.uuid4().hex[:6]}", product="CNC", apply_transaction_costs=True,
    )
    db_session.commit()

    # --- Strategy 3 Execution (BUY 40 shares) -> MUST BE BLOCKED ---
    snap3, exp3 = accounting.get_risk_snapshot(user.id)
    combined_qty = sum(Decimal(p["quantity"]) for p in snap3 if p["symbol"] == "RELIANCE")
    assert combined_qty == Decimal("100.0000") # Limit reached

    order3 = BrokerOrderRequest(
        symbol="RELIANCE", exchange="NSE", quantity=Decimal("40"), side="BUY",
        order_type="MARKET", product="CNC", variety="regular", price=candle_price,
    )
    with pytest.raises(RiskLimitExceededException) as exc_info:
        safety_service._risk_engine.validate_order(user.id, broker.id, order3, snap3, exp3)
    assert "exceeds limit of 100" in str(exc_info.value)

    # Strategy 3 bucket remained untouched
    port3 = paper_repo.get_portfolio_by_id(portfolios[2].id, user.id)
    assert port3.cash_balance == allocated_bucket

    # --- Candle 2: Take Profit Exit @ 1365 ---
    exit_price = Decimal("1365.00")
    for i in range(2):
        pos = paper_repo.get_position(portfolios[i].id, "RELIANCE")
        assert pos.quantity == Decimal("50.0000")
        accounting.record_fill(
            user_id=user.id, broker_id=broker.id, symbol="RELIANCE", side="SELL",
            quantity=pos.quantity, price=exit_price, execution_mode="PAPER",
            paper_portfolio_id=portfolios[i].id, strategy_instance_id=instances[i].id,
            execution_id=f"EX-EXIT-{uuid.uuid4().hex[:6]}", product="CNC", apply_transaction_costs=True,
        )
        db_session.commit()

    # Verify P&L and Final Consolidation
    pos1 = paper_repo.get_position(portfolios[0].id, "RELIANCE")
    pos2 = paper_repo.get_position(portfolios[1].id, "RELIANCE")
    pos3 = paper_repo.get_position(portfolios[2].id, "RELIANCE")

    assert pos1.quantity == Decimal("0.0000")
    assert pos2.quantity == Decimal("0.0000")
    assert pos3 is None or pos3.quantity == Decimal("0.0000")

    assert pos1.realized_pnl > Decimal("3000.00") # Net of costs ~+3179
    assert pos2.realized_pnl > Decimal("3000.00")
    
    all_user_ports = paper_repo.get_all_portfolios_for_user(user.id)
    total_realized_pnl = sum(p.realized_pnl for p in all_user_ports)
    assert total_realized_pnl == (pos1.realized_pnl + pos2.realized_pnl)
