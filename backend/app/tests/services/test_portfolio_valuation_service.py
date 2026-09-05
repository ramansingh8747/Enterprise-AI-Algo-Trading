from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4
from unittest.mock import Mock

from app.brokers.base.broker_types import BrokerQuote
from app.services.portfolio_valuation_service import PortfolioValuationService


def test_live_valuation_updates_market_value_and_unrealized_pnl():
    user_id = uuid4()
    broker_id = uuid4()
    position = SimpleNamespace(
        symbol="INFY", quantity=Decimal("10"), average_price=Decimal("100"),
        realized_pnl=Decimal("25"), last_price=None, market_value=Decimal("0"),
        unrealized_pnl=Decimal("0"), valuation_at=None,
    )
    live_repo = Mock()
    live_repo.list_for_account.return_value = [position]
    live_repo.db.commit = Mock()
    broker = Mock()
    broker.get_quotes.return_value = [BrokerQuote(symbol="INFY", bid=Decimal("109"), ask=Decimal("111"), last_price=Decimal("110"))]
    paper_repo = Mock()
    service = PortfolioValuationService(broker, live_repo, paper_repo)

    result = service.value_live(user_id, broker_id)

    assert position.last_price == Decimal("110")
    assert position.market_value == Decimal("1100.0000")
    assert position.unrealized_pnl == Decimal("100.0000")
    assert result.market_value == Decimal("1100.0000")
    assert result.realized_pnl == Decimal("25.0000")
    assert result.unrealized_pnl == Decimal("100.0000")
    assert result.total_pnl == Decimal("125.0000")
    assert result.equity == Decimal("1100.0000")
    live_repo.db.commit.assert_called_once()


def test_paper_valuation_uses_cash_plus_market_value():
    user_id = uuid4()
    broker_id = uuid4()
    portfolio_id = uuid4()
    portfolio = SimpleNamespace(execution_mode="PAPER", cash_balance=Decimal("9000"), realized_pnl=Decimal("50"))
    position = SimpleNamespace(
        symbol="RELIANCE", quantity=Decimal("20"), average_price=Decimal("400"),
        unrealized_pnl=Decimal("0"), market_value=Decimal("0"), last_price=None, valuation_at=None,
    )
    paper_repo = Mock()
    paper_repo.get_portfolio_by_id.return_value = portfolio
    paper_repo.get_all_positions_for_portfolio.return_value = [position]
    paper_repo.db.commit = Mock()
    broker = Mock()
    broker.get_quotes.return_value = [BrokerQuote(symbol="RELIANCE", bid=Decimal("419"), ask=Decimal("421"), last_price=Decimal("420"))]
    service = PortfolioValuationService(broker, Mock(), paper_repo)

    result = service.value_paper(user_id, portfolio_id, broker_id)

    assert position.last_price == Decimal("420")
    assert position.market_value == Decimal("8400.0000")
    assert position.unrealized_pnl == Decimal("400.0000")
    assert result.cash_balance == Decimal("9000")
    assert result.market_value == Decimal("8400.0000")
    assert result.equity == Decimal("17400.0000")
    assert result.total_pnl == Decimal("450.0000")
    paper_repo.db.commit.assert_called_once()
