import uuid
from decimal import Decimal
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.base import Base
from app.database.models.user import User, UserRole
from app.database.models.strategy import StrategyDefinition, StrategyInstance
from app.database.repositories.paper_portfolio_repository import PaperPortfolioRepository
from app.services.paper_accounting_service import PaperAccountingService
from app.exceptions.paper_accounting_exceptions import (
    InvalidExecutionModeException,
    InvalidPaperFillException,
    PaperPortfolioNotFoundException,
    InsufficientPaperPositionException,
    DuplicatePaperExecutionException,
)


@pytest.fixture
def db_session():
    """In-memory SQLite database session for fast, isolated accounting unit tests."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    # Create dummy User and StrategyInstance
    user = User(
        id=uuid.uuid4(),
        email="trader@enterprise.ai",
        username="trader",
        password_hash="hash",
        full_name="Trader",
        role=UserRole.TRADER,
        is_active=True,
    )
    session.add(user)

    strat_def = StrategyDefinition(
        id=uuid.uuid4(),
        user_id=user.id,
        name="Test Strat Def",
        strategy_type="DETERMINISTIC_MOMENTUM",
        is_active=True,
    )
    session.add(strat_def)

    strat_inst = StrategyInstance(
        id=uuid.uuid4(),
        strategy_definition_id=strat_def.id,
        user_id=user.id,
        broker_id=uuid.uuid4(),
        execution_mode="PAPER",
        status="RUNNING",
    )
    session.add(strat_inst)
    session.commit()

    yield session
    session.close()


@pytest.fixture
def accounting_service(db_session):
    repo = PaperPortfolioRepository(db=db_session)
    return PaperAccountingService(repository=repo)


def test_first_buy_creates_position(db_session, accounting_service):
    user = db_session.query(User).first()
    pos = accounting_service.record_fill(
        user_id=user.id,
        symbol="RELIANCE",
        side="BUY",
        quantity=Decimal("10.0000"),
        price=Decimal("2500.0000"),
        execution_mode="PAPER",
        execution_id="FILL-101",
    )

    assert pos.symbol == "RELIANCE"
    assert pos.quantity == Decimal("10.0000")
    assert pos.average_price == Decimal("2500.0000")
    assert pos.cost_basis == Decimal("25000.0000")
    assert pos.realized_pnl == Decimal("0.0000")


def test_additional_buy_expands_average_price(db_session, accounting_service):
    user = db_session.query(User).first()

    # First BUY: 10 @ 100
    accounting_service.record_fill(
        user_id=user.id,
        symbol="TATASTEEL",
        side="BUY",
        quantity=Decimal("10.0000"),
        price=Decimal("100.0000"),
        execution_mode="PAPER",
    )

    # Second BUY: 10 @ 110
    pos = accounting_service.record_fill(
        user_id=user.id,
        symbol="TATASTEEL",
        side="BUY",
        quantity=Decimal("10.0000"),
        price=Decimal("110.0000"),
        execution_mode="PAPER",
    )

    assert pos.quantity == Decimal("20.0000")
    assert pos.average_price == Decimal("105.0000")
    assert pos.cost_basis == Decimal("2100.0000")


def test_partial_sell_calculates_realized_pnl_and_retains_average_price(db_session, accounting_service):
    user = db_session.query(User).first()

    # BUY 20 @ 100
    accounting_service.record_fill(
        user_id=user.id,
        symbol="INFY",
        side="BUY",
        quantity=Decimal("20.0000"),
        price=Decimal("100.0000"),
        execution_mode="PAPER",
    )

    # Partial SELL: 5 @ 120 (Profit of 20 per share * 5 = +100 realized)
    pos = accounting_service.record_fill(
        user_id=user.id,
        symbol="INFY",
        side="SELL",
        quantity=Decimal("5.0000"),
        price=Decimal("120.0000"),
        execution_mode="PAPER",
    )

    assert pos.quantity == Decimal("15.0000")
    assert pos.average_price == Decimal("100.0000")
    assert pos.cost_basis == Decimal("1500.0000")
    assert pos.realized_pnl == Decimal("100.0000")


def test_full_sell_flattens_position_and_preserves_cumulative_realized_pnl(db_session, accounting_service):
    user = db_session.query(User).first()

    # BUY 10 @ 100
    accounting_service.record_fill(
        user_id=user.id,
        symbol="TCS",
        side="BUY",
        quantity=Decimal("10.0000"),
        price=Decimal("100.0000"),
        execution_mode="PAPER",
    )

    # Full SELL: 10 @ 150 (Profit of 50 per share * 10 = +500 realized)
    pos = accounting_service.record_fill(
        user_id=user.id,
        symbol="TCS",
        side="SELL",
        quantity=Decimal("10.0000"),
        price=Decimal("150.0000"),
        execution_mode="PAPER",
    )

    assert pos.quantity == Decimal("0.0000")
    assert pos.average_price == Decimal("0.0000")
    assert pos.cost_basis == Decimal("0.0000")
    assert pos.realized_pnl == Decimal("500.0000")


def test_loss_sell_subtracts_from_realized_pnl(db_session, accounting_service):
    user = db_session.query(User).first()

    # BUY 10 @ 100
    accounting_service.record_fill(
        user_id=user.id,
        symbol="WIPRO",
        side="BUY",
        quantity=Decimal("10.0000"),
        price=Decimal("100.0000"),
        execution_mode="PAPER",
    )

    # Loss SELL: 10 @ 80 (Loss of 20 per share * 10 = -200 realized)
    pos = accounting_service.record_fill(
        user_id=user.id,
        symbol="WIPRO",
        side="SELL",
        quantity=Decimal("10.0000"),
        price=Decimal("80.0000"),
        execution_mode="PAPER",
    )

    assert pos.quantity == Decimal("0.0000")
    assert pos.realized_pnl == Decimal("-200.0000")


def test_breakeven_sell(db_session, accounting_service):
    user = db_session.query(User).first()

    # BUY 10 @ 100
    accounting_service.record_fill(
        user_id=user.id,
        symbol="HDFC",
        side="BUY",
        quantity=Decimal("10.0000"),
        price=Decimal("100.0000"),
        execution_mode="PAPER",
    )

    # SELL 10 @ 100
    pos = accounting_service.record_fill(
        user_id=user.id,
        symbol="HDFC",
        side="SELL",
        quantity=Decimal("10.0000"),
        price=Decimal("100.0000"),
        execution_mode="PAPER",
    )

    assert pos.realized_pnl == Decimal("0.0000")


def test_multiple_buys_and_sells_sequence(db_session, accounting_service):
    user = db_session.query(User).first()

    # 1. BUY 10 @ 100
    accounting_service.record_fill(user_id=user.id, symbol="SBIN", side="BUY", quantity="10", price="100")
    # 2. BUY 10 @ 110 -> 20 @ 105
    accounting_service.record_fill(user_id=user.id, symbol="SBIN", side="BUY", quantity="10", price="110")
    # 3. SELL 5 @ 120 -> +75 PnL, 15 @ 105 remaining
    pos3 = accounting_service.record_fill(user_id=user.id, symbol="SBIN", side="SELL", quantity="5", price="120")
    assert pos3.quantity == Decimal("15.0000")
    assert pos3.average_price == Decimal("105.0000")
    assert pos3.realized_pnl == Decimal("75.0000")

    # 4. SELL 10 @ 90 -> Loss of (90-105)*10 = -150 PnL. Total PnL = 75 - 150 = -75. Remaining 5 @ 105
    pos4 = accounting_service.record_fill(user_id=user.id, symbol="SBIN", side="SELL", quantity="10", price="90")
    assert pos4.quantity == Decimal("5.0000")
    assert pos4.average_price == Decimal("105.0000")
    assert pos4.cost_basis == Decimal("525.0000")
    assert pos4.realized_pnl == Decimal("-75.0000")


def test_invalid_quantity_rejection(db_session, accounting_service):
    user = db_session.query(User).first()
    with pytest.raises(InvalidPaperFillException):
        accounting_service.record_fill(
            user_id=user.id, symbol="ITC", side="BUY", quantity=Decimal("0.0000"), price=Decimal("100.0000")
        )


def test_invalid_price_rejection(db_session, accounting_service):
    user = db_session.query(User).first()
    with pytest.raises(InvalidPaperFillException):
        accounting_service.record_fill(
            user_id=user.id, symbol="ITC", side="BUY", quantity=Decimal("10.0000"), price=Decimal("-10.0000")
        )


def test_sell_greater_than_position_rejection(db_session, accounting_service):
    user = db_session.query(User).first()
    accounting_service.record_fill(user_id=user.id, symbol="AXIS", side="BUY", quantity="10", price="100")

    with pytest.raises(InsufficientPaperPositionException):
        accounting_service.record_fill(user_id=user.id, symbol="AXIS", side="SELL", quantity="15", price="110")


def test_live_mode_execution_rejection(db_session, accounting_service):
    user = db_session.query(User).first()
    with pytest.raises(InvalidExecutionModeException):
        accounting_service.record_fill(
            user_id=user.id, symbol="ICICI", side="BUY", quantity="10", price="100", execution_mode="LIVE"
        )


def test_duplicate_execution_protection(db_session, accounting_service):
    user = db_session.query(User).first()
    accounting_service.record_fill(
        user_id=user.id, symbol="KOTAK", side="BUY", quantity="10", price="100", execution_id="FILL-999"
    )

    with pytest.raises(DuplicatePaperExecutionException):
        accounting_service.record_fill(
            user_id=user.id, symbol="KOTAK", side="BUY", quantity="10", price="100", execution_id="FILL-999"
        )


def test_user_and_strategy_isolation(db_session, accounting_service):
    user1 = db_session.query(User).first()

    # User 2
    user2 = User(
        id=uuid.uuid4(),
        email="user2@enterprise.ai",
        username="user2",
        password_hash="hash",
        full_name="User Two",
        role=UserRole.TRADER,
        is_active=True,
    )
    db_session.add(user2)
    db_session.commit()

    # User 1 BUY
    pos1 = accounting_service.record_fill(user_id=user1.id, symbol="LT", side="BUY", quantity="10", price="100")

    # User 2 BUY
    pos2 = accounting_service.record_fill(user_id=user2.id, symbol="LT", side="BUY", quantity="50", price="200")

    assert pos1.user_id == user1.id
    assert pos1.quantity == Decimal("10.0000")
    assert pos2.user_id == user2.id
    assert pos2.quantity == Decimal("50.0000")
    assert pos1.id != pos2.id
