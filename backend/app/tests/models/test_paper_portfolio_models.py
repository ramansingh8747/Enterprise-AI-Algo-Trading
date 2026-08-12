import uuid
from decimal import Decimal
from datetime import datetime, timezone

from app.database.models.paper_portfolio import PaperPortfolio, PaperPosition


def test_paper_portfolio_model_defaults_and_decimal_types():
    user_id = uuid.uuid4()
    strat_id = uuid.uuid4()

    portfolio = PaperPortfolio(
        user_id=user_id,
        strategy_instance_id=strat_id,
        name="Test Strategy Paper Account",
    )

    assert isinstance(portfolio.id, uuid.UUID)
    assert portfolio.user_id == user_id
    assert portfolio.strategy_instance_id == strat_id
    assert portfolio.execution_mode == "PAPER"
    assert portfolio.currency == "INR"
    assert portfolio.initial_balance == Decimal("1000000.0000")
    assert portfolio.cash_balance == Decimal("1000000.0000")
    assert portfolio.realized_pnl == Decimal("0.0000")
    assert isinstance(portfolio.initial_balance, Decimal)
    assert isinstance(portfolio.cash_balance, Decimal)


def test_paper_position_model_defaults_and_unique_constraint():
    user_id = uuid.uuid4()
    portfolio_id = uuid.uuid4()
    strat_id = uuid.uuid4()

    position = PaperPosition(
        paper_portfolio_id=portfolio_id,
        user_id=user_id,
        strategy_instance_id=strat_id,
        symbol="TATASTEEL",
        quantity=Decimal("50.0000"),
        average_price=Decimal("150.2500"),
        cost_basis=Decimal("7512.5000"),
    )

    assert position.paper_portfolio_id == portfolio_id
    assert position.symbol == "TATASTEEL"
    assert position.quantity == Decimal("50.0000")
    assert position.average_price == Decimal("150.2500")
    assert position.cost_basis == Decimal("7512.5000")
    assert position.realized_pnl == Decimal("0.0000")
    assert position.unrealized_pnl == Decimal("0.0000")
    assert isinstance(position.quantity, Decimal)
    assert isinstance(position.average_price, Decimal)
