from __future__ import annotations

from decimal import Decimal
from math import ceil
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.orm import Session

from app.core.logging.logger import logger
from app.database.models.broker import Broker
from app.database.models.paper_portfolio import PaperPortfolio, PaperPosition
from app.database.models.strategy import StrategyDefinition, StrategyInstance, StrategySignal
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
    snapshot.
    """

    def __init__(self, db: Session) -> None:
        self.db = db

    def _decimal(self, val: object) -> Decimal:
        if val is None:
            return ZERO
        return Decimal(str(val))

    def _money(self, val: Decimal) -> str:
        return f"{val:.4f}"

    def _paper_query(
        self,
        search: Optional[str] = None,
        user_id: Optional[UUID] = None,
        broker_id: Optional[UUID] = None,
        strategy_instance_id: Optional[UUID] = None,
    ):
        query = (
            select(PaperPortfolio, User, StrategyInstance, StrategyDefinition, Broker)
            .join(User, User.id == PaperPortfolio.user_id)
            .outerjoin(StrategyInstance, StrategyInstance.id == PaperPortfolio.strategy_instance_id)
            .outerjoin(StrategyDefinition, StrategyDefinition.id == StrategyInstance.strategy_definition_id)
            .outerjoin(Broker, Broker.id == StrategyInstance.broker_id)
        )
        if search:
            pattern = f"%{search.strip()}%"
            query = query.where(
                or_(
                    User.full_name.ilike(pattern),
                    User.phone.ilike(pattern),
                    StrategyDefinition.name.ilike(pattern),
                    Broker.broker_name.ilike(pattern),
                    PaperPortfolio.name.ilike(pattern),
                )
            )
        if user_id:
            query = query.where(PaperPortfolio.user_id == user_id)
        if broker_id:
            query = query.where(StrategyInstance.broker_id == broker_id)
        if strategy_instance_id:
            query = query.where(PaperPortfolio.strategy_instance_id == strategy_instance_id)
        return query.order_by(PaperPortfolio.updated_at.desc())

    def _live_groups(
        self,
        search: Optional[str] = None,
        user_id: Optional[UUID] = None,
        broker_id: Optional[UUID] = None,
        strategy_instance_id: Optional[UUID] = None,
    ):
        query = (
            select(TradingPosition, User, StrategyInstance, StrategyDefinition, Broker)
            .join(User, User.id == TradingPosition.user_id)
            .outerjoin(StrategyInstance, StrategyInstance.id == TradingPosition.strategy_instance_id)
            .outerjoin(StrategyDefinition, StrategyDefinition.id == StrategyInstance.strategy_definition_id)
            .outerjoin(Broker, Broker.id == TradingPosition.broker_id)
            .where(TradingPosition.quantity != 0)
        )
        if search:
            pattern = f"%{search.strip()}%"
            query = query.where(
                or_(
                    User.full_name.ilike(pattern),
                    User.phone.ilike(pattern),
                    StrategyDefinition.name.ilike(pattern),
                    Broker.broker_name.ilike(pattern),
                    TradingPosition.symbol.ilike(pattern),
                )
            )
        if user_id:
            query = query.where(TradingPosition.user_id == user_id)
        if broker_id:
            query = query.where(TradingPosition.broker_id == broker_id)
        if strategy_instance_id:
            query = query.where(TradingPosition.strategy_instance_id == strategy_instance_id)

        rows = self.db.execute(query).all()
        grouped: dict[tuple, dict] = {}
        for pos, user, instance, definition, broker in rows:
            key = (pos.user_id, pos.broker_id, pos.strategy_instance_id)
            if key not in grouped:
                grouped[key] = {
                    "user": user,
                    "broker": broker,
                    "instance": instance,
                    "definition": definition,
                    "invested_value": ZERO,
                    "market_value": ZERO,
                    "realized_pnl": ZERO,
                    "unrealized_pnl": ZERO,
                    "position_count": 0,
                    "updated_at": pos.updated_at,
                    "valuation_at": pos.valuation_at,
                }
            entry = grouped[key]
            cost = self._decimal(pos.average_entry_price) * abs(self._decimal(pos.quantity))
            mval = self._decimal(pos.current_price) * abs(self._decimal(pos.quantity)) if pos.current_price else cost
            unreal = self._decimal(pos.unrealized_pnl)
            real = self._decimal(pos.realized_pnl)
            entry["invested_value"] += cost
            entry["market_value"] += mval
            entry["unrealized_pnl"] += unreal
            entry["realized_pnl"] += real
            entry["position_count"] += 1
            if pos.updated_at and (entry["updated_at"] is None or pos.updated_at > entry["updated_at"]):
                entry["updated_at"] = pos.updated_at
            if pos.valuation_at and (entry["valuation_at"] is None or pos.valuation_at > entry["valuation_at"]):
                entry["valuation_at"] = pos.valuation_at

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
            updated = bucket["updated_at"]
            valuation = bucket["valuation_at"]
            items.append(AdminPortfolioItem(
                portfolio_ref=instance.id if instance else user.id, source="LIVE_ACCOUNT", execution_mode="LIVE",
                user_id=user.id, user_name=user.full_name, user_role=str(user.role),
                broker_id=broker.id if broker else None, broker_name=broker.broker_name if broker else None,
                strategy_instance_id=instance.id if instance else None, strategy_name=definition.name if definition else None,
                currency="INR", initial_balance=None, cash_balance=None,
                invested_value=self._money(invested), market_value=self._money(market), realized_pnl=self._money(realized),
                unrealized_pnl=self._money(unreal), total_pnl=self._money(total), equity=self._money(market),
                position_count=bucket["position_count"], valuation_at=valuation.isoformat() if valuation else None,
                updated_at=updated.isoformat() if updated else "",
            ))

        items.sort(key=lambda x: x.updated_at, reverse=True)
        total_count = len(items)
        pages = ceil(total_count / page_size) if total_count else 0
        start = (page - 1) * page_size
        page_items = items[start:start + page_size]

        def dec(field: str) -> Decimal:
            return sum(
                (Decimal(getattr(it, field)) for it in items if getattr(it, field) is not None),
                ZERO,
            )

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
        try:
            portfolio = self.db.get(PaperPortfolio, portfolio_id)
            if not portfolio:
                return False
            # Clean up paper positions for this portfolio
            self.db.execute(delete(PaperPosition).where(PaperPosition.paper_portfolio_id == portfolio_id))
            
            instance_id = portfolio.strategy_instance_id
            portfolio.strategy_instance_id = None
            self.db.delete(portfolio)
            self.db.flush()

            if instance_id:
                other_count = self.db.scalar(
                    select(func.count(PaperPortfolio.id)).where(PaperPortfolio.strategy_instance_id == instance_id)
                ) or 0
                if other_count == 0:
                    self.db.execute(delete(StrategySignal).where(StrategySignal.strategy_instance_id == instance_id))
                    self.db.execute(delete(PaperPosition).where(PaperPosition.strategy_instance_id == instance_id))
                    instance = self.db.get(StrategyInstance, instance_id)
                    if instance:
                        self.db.delete(instance)
            self.db.commit()
            return True
        except Exception as e:
            self.db.rollback()
            logger.error("Error deleting paper portfolio %s: %s", portfolio_id, e)
            raise

    def purge_test_portfolios(self) -> int:
        """Purge test broker paper portfolios (e.g. TestBroker, Zerodha, or test instances)."""
        stmt = (
            select(PaperPortfolio.id)
            .outerjoin(StrategyInstance, StrategyInstance.id == PaperPortfolio.strategy_instance_id)
            .outerjoin(Broker, Broker.id == StrategyInstance.broker_id)
            .where(or_(
                Broker.broker_name.ilike("%test%"),
                Broker.broker_name.ilike("%zerodha%"),
                Broker.broker_type.ilike("%zerodha%"),
                Broker.broker_type.ilike("%test%"),
            ))
        )
        portfolio_ids = [row[0] for row in self.db.execute(stmt).fetchall()]
        if not portfolio_ids:
            return 0

        try:
            # 1. Bulk delete paper positions
            self.db.execute(
                delete(PaperPosition).where(PaperPosition.paper_portfolio_id.in_(portfolio_ids))
            )

            # 2. Find strategy instances attached to these portfolios
            instance_ids_stmt = select(PaperPortfolio.strategy_instance_id).where(
                and_(
                    PaperPortfolio.id.in_(portfolio_ids),
                    PaperPortfolio.strategy_instance_id.isnot(None),
                )
            )
            raw_instance_ids = [row[0] for row in self.db.execute(instance_ids_stmt).fetchall() if row[0] is not None]

            # 3. Bulk delete paper portfolios
            self.db.execute(
                delete(PaperPortfolio).where(PaperPortfolio.id.in_(portfolio_ids))
            )
            self.db.flush()

            # 4. Clean up orphaned instances
            if raw_instance_ids:
                remaining_refs_stmt = select(PaperPortfolio.strategy_instance_id).where(
                    PaperPortfolio.strategy_instance_id.in_(raw_instance_ids)
                )
                still_used = set(row[0] for row in self.db.execute(remaining_refs_stmt).fetchall())
                orphaned_ids = [iid for iid in raw_instance_ids if iid not in still_used]
                if orphaned_ids:
                    self.db.execute(delete(StrategySignal).where(StrategySignal.strategy_instance_id.in_(orphaned_ids)))
                    self.db.execute(delete(PaperPosition).where(PaperPosition.strategy_instance_id.in_(orphaned_ids)))
                    self.db.execute(delete(StrategyInstance).where(StrategyInstance.id.in_(orphaned_ids)))

            self.db.commit()
            return len(portfolio_ids)
        except Exception as e:
            self.db.rollback()
            logger.error("Error purging test portfolios: %s", e)
            raise
