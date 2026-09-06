from __future__ import annotations

from decimal import Decimal
from math import ceil
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.orm import Session

from app.database.models.broker import Broker
from app.database.models.paper_portfolio import PaperPortfolio, PaperPosition
from app.database.models.strategy import StrategyDefinition, StrategyInstance
from app.database.models.trading_execution import TradingPosition
from app.database.models.user import User
from app.schemas.admin_portfolio import (
    AdminPortfolioItem,
    AdminPortfolioListResponse,
    AdminPortfolioSummary,
)

ZERO = Decimal("0.0000")


class AdminPortfolioService:
    """Read-only admin portfolio/account view backed by persisted portfolio state.

    PAPER accounts use PaperPortfolio + PaperPosition. LIVE accounts are grouped
    from application-owned TradingPosition records. LIVE cash is intentionally
    nullable because the current persisted model does not own a broker cash
    snapshot; the service never invents a cash value.
    """

    def __init__(self, db: Session) -> None:
        self.db = db

    @staticmethod
    def _decimal(value) -> Decimal:
        return Decimal(str(value or 0))

    @staticmethod
    def _money(value: Decimal) -> str:
        return str(value.quantize(ZERO))

    def _paper_query(self, search: Optional[str], user_id: Optional[UUID], broker_id: Optional[UUID], strategy_instance_id: Optional[UUID]):
        filters = [PaperPortfolio.execution_mode == "PAPER"]
        if user_id:
            filters.append(PaperPortfolio.user_id == user_id)
        if strategy_instance_id:
            filters.append(PaperPortfolio.strategy_instance_id == strategy_instance_id)
        if broker_id:
            filters.append(StrategyInstance.broker_id == broker_id)
        if search:
            like = f"%{search.strip()}%"
            filters.append(or_(
                PaperPortfolio.name.ilike(like),
                User.full_name.ilike(like),
                User.username.ilike(like),
                User.email.ilike(like),
                Broker.broker_name.ilike(like),
                StrategyDefinition.name.ilike(like),
            ))
        return (
            select(PaperPortfolio, User, StrategyInstance, StrategyDefinition, Broker)
            .join(User, User.id == PaperPortfolio.user_id)
            .outerjoin(StrategyInstance, StrategyInstance.id == PaperPortfolio.strategy_instance_id)
            .outerjoin(StrategyDefinition, StrategyDefinition.id == StrategyInstance.strategy_definition_id)
            .outerjoin(Broker, Broker.id == StrategyInstance.broker_id)
            .where(and_(*filters))
        )

    def _live_groups(self, search: Optional[str], user_id: Optional[UUID], broker_id: Optional[UUID], strategy_instance_id: Optional[UUID]):
        filters = [TradingPosition.quantity != 0]
        if user_id:
            filters.append(TradingPosition.user_id == user_id)
        if broker_id:
            filters.append(TradingPosition.broker_id == broker_id)
        if strategy_instance_id:
            filters.append(TradingPosition.strategy_instance_id == strategy_instance_id)
        if search:
            like = f"%{search.strip()}%"
            filters.append(or_(
                TradingPosition.symbol.ilike(like),
                User.full_name.ilike(like),
                User.username.ilike(like),
                User.email.ilike(like),
                Broker.broker_name.ilike(like),
                StrategyDefinition.name.ilike(like),
            ))
        rows = self.db.execute(
            select(TradingPosition, User, Broker, StrategyInstance, StrategyDefinition)
            .join(User, User.id == TradingPosition.user_id)
            .join(Broker, Broker.id == TradingPosition.broker_id)
            .outerjoin(StrategyInstance, StrategyInstance.id == TradingPosition.strategy_instance_id)
            .outerjoin(StrategyDefinition, StrategyDefinition.id == StrategyInstance.strategy_definition_id)
            .where(and_(*filters))
        ).all()

        grouped = {}
        for position, user, broker, instance, definition in rows:
            key = (position.user_id, position.broker_id, position.strategy_instance_id)
            bucket = grouped.setdefault(key, {
                "user": user, "broker": broker, "instance": instance, "definition": definition,
                "invested_value": ZERO, "market_value": ZERO, "realized_pnl": ZERO, "unrealized_pnl": ZERO,
                "position_count": 0, "updated_at": position.updated_at, "valuation_at": position.valuation_at,
            })
            qty = self._decimal(position.quantity)
            bucket["invested_value"] += qty * self._decimal(position.average_price)
            bucket["market_value"] += self._decimal(position.market_value)
            bucket["realized_pnl"] += self._decimal(position.realized_pnl)
            bucket["unrealized_pnl"] += self._decimal(position.unrealized_pnl)
            bucket["position_count"] += 1
            bucket["updated_at"] = max(bucket["updated_at"], position.updated_at)
            if position.valuation_at and (bucket["valuation_at"] is None or position.valuation_at > bucket["valuation_at"]):
                bucket["valuation_at"] = position.valuation_at
        return grouped.values()

    def list_portfolios(
        self,
        *,
        page: int = 1,
        page_size: int = 25,
        search: Optional[str] = None,
        execution_mode: Optional[str] = None,
        user_id: Optional[UUID] = None,
        broker_id: Optional[UUID] = None,
        strategy_instance_id: Optional[UUID] = None,
    ) -> AdminPortfolioListResponse:
        mode = execution_mode.upper() if execution_mode else None
        paper_rows = []
        live_rows = []
        if mode in (None, "PAPER"):
            paper_rows = self.db.execute(self._paper_query(search, user_id, broker_id, strategy_instance_id)).all()
        if mode in (None, "LIVE"):
            live_rows = list(self._live_groups(search, user_id, broker_id, strategy_instance_id))

        items: list[AdminPortfolioItem] = []
        for portfolio, user, instance, definition, broker in paper_rows:
            positions = self.db.execute(
                select(func.count(PaperPosition.id)).where(and_(PaperPosition.paper_portfolio_id == portfolio.id, PaperPosition.quantity != 0))
            ).scalar_one()
            market_value = self.db.scalar(
                select(func.coalesce(func.sum(PaperPosition.market_value), 0)).where(and_(PaperPosition.paper_portfolio_id == portfolio.id, PaperPosition.quantity != 0))
            ) or 0
            invested_value = self.db.scalar(
                select(func.coalesce(func.sum(PaperPosition.cost_basis), 0)).where(and_(PaperPosition.paper_portfolio_id == portfolio.id, PaperPosition.quantity != 0))
            ) or 0
            unrealized = self.db.scalar(
                select(func.coalesce(func.sum(PaperPosition.unrealized_pnl), 0)).where(and_(PaperPosition.paper_portfolio_id == portfolio.id, PaperPosition.quantity != 0))
            ) or 0
            realized = self._decimal(portfolio.realized_pnl)
            invested = self._decimal(invested_value)
            market = self._decimal(market_value)
            unreal = self._decimal(unrealized)
            cash = self._decimal(portfolio.cash_balance)
            total = realized + unreal
            equity = cash + market
            updated = portfolio.updated_at
            valuation = self.db.scalar(
                select(func.max(PaperPosition.valuation_at)).where(and_(PaperPosition.paper_portfolio_id == portfolio.id, PaperPosition.quantity != 0))
            )
            items.append(AdminPortfolioItem(
                portfolio_ref=portfolio.id, source="PAPER_PORTFOLIO", execution_mode="PAPER",
                user_id=user.id, user_name=user.full_name, user_role=str(user.role),
                broker_id=broker.id if broker else None, broker_name=broker.broker_name if broker else None,
                strategy_instance_id=instance.id if instance else None, strategy_name=definition.name if definition else None,
                currency=portfolio.currency, initial_balance=self._money(self._decimal(portfolio.initial_balance)),
                cash_balance=self._money(cash), invested_value=self._money(invested), market_value=self._money(market),
                realized_pnl=self._money(realized), unrealized_pnl=self._money(unreal), total_pnl=self._money(total),
                equity=self._money(equity), position_count=int(positions), valuation_at=valuation.isoformat() if valuation else None,
                updated_at=updated.isoformat(),
            ))

        for bucket in live_rows:
            invested = bucket["invested_value"]
            market = bucket["market_value"]
            realized = bucket["realized_pnl"]
            unreal = bucket["unrealized_pnl"]
            total = realized + unreal
            user = bucket["user"]
            broker = bucket["broker"]
            instance = bucket["instance"]
            definition = bucket["definition"]
            # Stable deterministic account reference for this persisted LIVE account grouping.
            import uuid as _uuid
            account_ref = _uuid.uuid5(_uuid.NAMESPACE_URL, f"live:{user.id}:{broker.id}:{instance.id if instance else 'none'}")
            items.append(AdminPortfolioItem(
                portfolio_ref=account_ref, source="LIVE_ACCOUNT", execution_mode="LIVE",
                user_id=user.id, user_name=user.full_name, user_role=str(user.role),
                broker_id=broker.id, broker_name=broker.broker_name,
                strategy_instance_id=instance.id if instance else None, strategy_name=definition.name if definition else None,
                currency="INR", initial_balance=None, cash_balance=None, invested_value=self._money(invested),
                market_value=self._money(market), realized_pnl=self._money(realized), unrealized_pnl=self._money(unreal),
                total_pnl=self._money(total), equity=self._money(market), position_count=bucket["position_count"],
                valuation_at=bucket["valuation_at"].isoformat() if bucket["valuation_at"] else None,
                updated_at=bucket["updated_at"].isoformat(),
            ))

        items.sort(key=lambda item: item.updated_at, reverse=True)
        total_count = len(items)
        pages = ceil(total_count / page_size) if total_count else 0
        offset = (page - 1) * page_size
        page_items = items[offset:offset + page_size]

        def dec(field: str) -> Decimal:
            return sum((self._decimal(getattr(item, field)) for item in items), ZERO)

        summary = AdminPortfolioSummary(
            total_accounts=total_count,
            paper_accounts=sum(1 for item in items if item.execution_mode == "PAPER"),
            live_accounts=sum(1 for item in items if item.execution_mode == "LIVE"),
            total_cash_balance=self._money(dec("cash_balance")),
            total_invested_value=self._money(dec("invested_value")),
            total_market_value=self._money(dec("market_value")),
            realized_pnl=self._money(dec("realized_pnl")),
            unrealized_pnl=self._money(dec("unrealized_pnl")),
            total_pnl=self._money(dec("total_pnl")),
            total_equity=self._money(dec("equity")),
        )
        return AdminPortfolioListResponse(items=page_items, total=total_count, page=page, page_size=page_size, pages=pages, summary=summary)

    def get_portfolio(self, portfolio_ref: UUID, source: str) -> Optional[AdminPortfolioItem]:
        response = self.list_portfolios(page=1, page_size=100, execution_mode="PAPER" if source == "PAPER_PORTFOLIO" else "LIVE")
        return next((item for item in response.items if item.portfolio_ref == portfolio_ref and item.source == source), None)

    def delete_paper_portfolio(self, portfolio_id: UUID) -> bool:
        portfolio = self.db.get(PaperPortfolio, portfolio_id)
        if not portfolio:
            return False
        self.db.execute(delete(PaperPosition).where(PaperPosition.portfolio_id == portfolio_id))
        if portfolio.strategy_instance_id:
            instance = self.db.get(StrategyInstance, portfolio.strategy_instance_id)
            if instance:
                self.db.delete(instance)
        self.db.delete(portfolio)
        self.db.commit()
        return True

    def purge_test_portfolios(self) -> int:
        """Purge test broker paper portfolios (e.g. TestBroker, Zerodha, or unassigned)."""
        stmt = (
            select(PaperPortfolio.id)
            .outerjoin(StrategyInstance, StrategyInstance.id == PaperPortfolio.strategy_instance_id)
            .outerjoin(Broker, Broker.id == StrategyInstance.broker_id)
            .where(or_(
                Broker.broker_name.ilike("%test%"),
                Broker.broker_name.ilike("%zerodha%"),
                Broker.broker_type.ilike("%zerodha%"),
                StrategyInstance.broker_id.is_(None)
            ))
        )
        portfolio_ids = [row[0] for row in self.db.execute(stmt).fetchall()]
        count = 0
        for pid in portfolio_ids:
            if self.delete_paper_portfolio(pid):
                count += 1
        return count
