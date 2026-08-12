import uuid
from decimal import Decimal
from datetime import datetime, timezone, timedelta
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.base import Base
from app.database.models.user import User, UserRole
from app.database.models.strategy import StrategyDefinition, StrategyInstance
from app.database.models.paper_portfolio import PaperPortfolio, PaperPosition
from app.database.repositories.paper_portfolio_repository import PaperPortfolioRepository
from app.services.paper_accounting_service import PaperAccountingService
from app.services.paper_valuation_service import PaperValuationService
from app.brokers.base.broker_types import BrokerQuote
from app.exceptions.paper_accounting_exceptions import (
    InvalidExecutionModeException,
    PaperPortfolioNotFoundException,
    PaperPositionNotFoundException,
    StaleQuoteDataException,
    InvalidQuoteException,
)


@pytest.fixture
def db_session():
    """In-memory SQLite database session for fast, isolated valuation unit tests."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

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
def repository(db_session):
    return PaperPortfolioRepository(db=db_session)


@pytest.fixture
def accounting_service(repository):
    return PaperAccountingService(repository=repository)


@pytest.fixture
def valuation_service(repository):
    return PaperValuationService(repository=repository, max_quote_age_seconds=10)


def test_fresh_quote_profit_valuation(db_session, accounting_service, valuation_service):
    user = db_session.query(User).first()
    pos = accounting_service.record_fill(
        user_id=user.id,
        symbol="RELIANCE",
        side="BUY",
        quantity="10.0000",
        price="100.0000",
        execution_mode="PAPER",
    )

    now = datetime.now(timezone.utc)
    quote = {
        "symbol": "RELIANCE",
        "last_price": "120.0000",
        "timestamp": now.isoformat(),
    }

    valued_pos = valuation_service.value_position(
        user_id=user.id,
        paper_portfolio_id=pos.paper_portfolio_id,
        symbol="RELIANCE",
        quote=quote,
        execution_mode="PAPER",
    )

    # (120 - 100) * 10 = +200.0000
    assert valued_pos.unrealized_pnl == Decimal("200.0000")
    assert valued_pos.realized_pnl == Decimal("0.0000")


def test_fresh_quote_loss_valuation(db_session, accounting_service, valuation_service):
    user = db_session.query(User).first()
    pos = accounting_service.record_fill(
        user_id=user.id,
        symbol="TATASTEEL",
        side="BUY",
        quantity="10.0000",
        price="100.0000",
        execution_mode="PAPER",
    )

    now = datetime.now(timezone.utc)
    quote = {
        "symbol": "TATASTEEL",
        "last_price": "90.0000",
        "timestamp": now.isoformat(),
    }

    valued_pos = valuation_service.value_position(
        user_id=user.id,
        paper_portfolio_id=pos.paper_portfolio_id,
        symbol="TATASTEEL",
        quote=quote,
        execution_mode="PAPER",
    )

    # (90 - 100) * 10 = -100.0000
    assert valued_pos.unrealized_pnl == Decimal("-100.0000")


def test_breakeven_valuation(db_session, accounting_service, valuation_service):
    user = db_session.query(User).first()
    pos = accounting_service.record_fill(
        user_id=user.id,
        symbol="INFY",
        side="BUY",
        quantity="10.0000",
        price="100.0000",
        execution_mode="PAPER",
    )

    now = datetime.now(timezone.utc)
    quote_data = {"symbol": "INFY", "last_price": Decimal("100.0000"), "timestamp": now}

    valued_pos = valuation_service.value_position(
        user_id=user.id,
        paper_portfolio_id=pos.paper_portfolio_id,
        symbol="INFY",
        quote=quote_data,
        execution_mode="PAPER",
    )

    assert valued_pos.unrealized_pnl == Decimal("0.0000")


def test_stale_quote_rejection(db_session, accounting_service, valuation_service):
    user = db_session.query(User).first()
    pos = accounting_service.record_fill(
        user_id=user.id, symbol="TCS", side="BUY", quantity="10", price="100", execution_mode="PAPER"
    )

    stale_ts = datetime.now(timezone.utc) - timedelta(seconds=15)
    quote = {"symbol": "TCS", "last_price": "110", "timestamp": stale_ts.isoformat()}

    with pytest.raises(StaleQuoteDataException):
        valuation_service.value_position(
            user_id=user.id,
            paper_portfolio_id=pos.paper_portfolio_id,
            symbol="TCS",
            quote=quote,
            execution_mode="PAPER",
        )


def test_missing_timestamp_rejection(db_session, accounting_service, valuation_service):
    user = db_session.query(User).first()
    pos = accounting_service.record_fill(
        user_id=user.id, symbol="WIPRO", side="BUY", quantity="10", price="100", execution_mode="PAPER"
    )

    quote = {"symbol": "WIPRO", "last_price": "110"}

    with pytest.raises(StaleQuoteDataException):
        valuation_service.value_position(
            user_id=user.id,
            paper_portfolio_id=pos.paper_portfolio_id,
            symbol="WIPRO",
            quote=quote,
            execution_mode="PAPER",
        )


def test_future_timestamp_rejection(db_session, accounting_service, valuation_service):
    user = db_session.query(User).first()
    pos = accounting_service.record_fill(
        user_id=user.id, symbol="HDFC", side="BUY", quantity="10", price="100", execution_mode="PAPER"
    )

    future_ts = datetime.now(timezone.utc) + timedelta(seconds=10)
    quote = {"symbol": "HDFC", "last_price": "110", "timestamp": future_ts.isoformat()}

    with pytest.raises(StaleQuoteDataException):
        valuation_service.value_position(
            user_id=user.id,
            paper_portfolio_id=pos.paper_portfolio_id,
            symbol="HDFC",
            quote=quote,
            execution_mode="PAPER",
        )


def test_negative_or_zero_price_rejection(db_session, accounting_service, valuation_service):
    user = db_session.query(User).first()
    pos = accounting_service.record_fill(
        user_id=user.id, symbol="SBIN", side="BUY", quantity="10", price="100", execution_mode="PAPER"
    )

    now = datetime.now(timezone.utc)
    quote_zero = {"symbol": "SBIN", "last_price": "0.0000", "timestamp": now.isoformat()}
    quote_neg = {"symbol": "SBIN", "last_price": "-10.0000", "timestamp": now.isoformat()}

    with pytest.raises(InvalidQuoteException):
        valuation_service.value_position(
            user_id=user.id,
            paper_portfolio_id=pos.paper_portfolio_id,
            symbol="SBIN",
            quote=quote_zero,
            execution_mode="PAPER",
        )

    with pytest.raises(InvalidQuoteException):
        valuation_service.value_position(
            user_id=user.id,
            paper_portfolio_id=pos.paper_portfolio_id,
            symbol="SBIN",
            quote=quote_neg,
            execution_mode="PAPER",
        )


def test_realized_pnl_preservation_during_valuation(db_session, accounting_service, valuation_service):
    user = db_session.query(User).first()
    # BUY 20 @ 100
    pos = accounting_service.record_fill(
        user_id=user.id, symbol="ITC", side="BUY", quantity="20", price="100", execution_mode="PAPER"
    )
    # SELL 10 @ 150 -> Realized P&L = +500
    pos = accounting_service.record_fill(
        user_id=user.id, symbol="ITC", side="SELL", quantity="10", price="150", execution_mode="PAPER"
    )
    assert pos.realized_pnl == Decimal("500.0000")

    # Refresh market quote to 120 (Unrealized on remaining 10 = (120 - 100) * 10 = +200)
    now = datetime.now(timezone.utc)
    quote = {"symbol": "ITC", "last_price": "120.0000", "timestamp": now.isoformat()}

    valued_pos = valuation_service.value_position(
        user_id=user.id,
        paper_portfolio_id=pos.paper_portfolio_id,
        symbol="ITC",
        quote=quote,
        execution_mode="PAPER",
    )

    assert valued_pos.realized_pnl == Decimal("500.0000")  # MUST REMAIN UNTOUCHED
    assert valued_pos.unrealized_pnl == Decimal("200.0000")


def test_closed_position_unrealized_pnl_reset(db_session, accounting_service, valuation_service):
    user = db_session.query(User).first()
    pos = accounting_service.record_fill(
        user_id=user.id, symbol="AXIS", side="BUY", quantity="10", price="100", execution_mode="PAPER"
    )
    pos = accounting_service.record_fill(
        user_id=user.id, symbol="AXIS", side="SELL", quantity="10", price="100", execution_mode="PAPER"
    )
    assert pos.quantity == Decimal("0.0000")

    now = datetime.now(timezone.utc)
    quote = {"symbol": "AXIS", "last_price": "150.0000", "timestamp": now.isoformat()}

    valued_pos = valuation_service.value_position(
        user_id=user.id,
        paper_portfolio_id=pos.paper_portfolio_id,
        symbol="AXIS",
        quote=quote,
        execution_mode="PAPER",
    )

    assert valued_pos.quantity == Decimal("0.0000")
    assert valued_pos.unrealized_pnl == Decimal("0.0000")


def test_live_mode_rejection(db_session, accounting_service, valuation_service):
    user = db_session.query(User).first()
    pos = accounting_service.record_fill(
        user_id=user.id, symbol="ICICI", side="BUY", quantity="10", price="100", execution_mode="PAPER"
    )

    now = datetime.now(timezone.utc)
    quote = {"symbol": "ICICI", "last_price": "110", "timestamp": now.isoformat()}

    with pytest.raises(InvalidExecutionModeException):
        valuation_service.value_position(
            user_id=user.id,
            paper_portfolio_id=pos.paper_portfolio_id,
            symbol="ICICI",
            quote=quote,
            execution_mode="LIVE",
        )


def test_batch_portfolio_valuation_skips_missing_quotes(db_session, accounting_service, valuation_service):
    user = db_session.query(User).first()
    pos1 = accounting_service.record_fill(
        user_id=user.id, symbol="KOTAK", side="BUY", quantity="10", price="100", execution_mode="PAPER"
    )
    pos2 = accounting_service.record_fill(
        user_id=user.id, symbol="MARUTI", side="BUY", quantity="5", price="1000", execution_mode="PAPER"
    )

    now = datetime.now(timezone.utc)
    quotes = {
        "KOTAK": {"symbol": "KOTAK", "last_price": "110", "timestamp": now.isoformat()},
        # MARUTI quote is omitted intentionally!
    }

    results = valuation_service.value_portfolio_positions(
        user_id=user.id,
        paper_portfolio_id=pos1.paper_portfolio_id,
        quotes_by_symbol=quotes,
        execution_mode="PAPER",
    )

    assert len(results) == 1
    assert results[0].symbol == "KOTAK"
    assert results[0].unrealized_pnl == Decimal("100.0000")

    # MARUTI position state remains unchanged
    pos2_reloaded = db_session.query(PaperPosition).filter_by(id=pos2.id).one()
    assert pos2_reloaded.unrealized_pnl == Decimal("0.0000")
