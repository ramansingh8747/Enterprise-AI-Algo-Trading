from decimal import Decimal

from app.services.admin_portfolio_service import AdminPortfolioService


def test_admin_portfolio_money_normalization():
    assert AdminPortfolioService._money(Decimal("123.45678")) == "123.4568"
    assert AdminPortfolioService._money(Decimal("0")) == "0.0000"
