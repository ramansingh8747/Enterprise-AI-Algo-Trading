from __future__ import annotations

from decimal import Decimal
from math import ceil
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, case, func, literal, or_, select, union_all
from sqlalchemy.orm import Session

from app.database.models.broker import Broker
from app.database.models.paper_portfolio import PaperPosition
from app.database.models.strategy import StrategyDefinition, StrategyInstance
from app.database.models.trading_execution import TradingPosition
from app.database.models.user import User
from app.schemas.admin_positions import AdminPositionItem, AdminPositionListResponse, AdminPositionSummary


class AdminPositionService:
    """Read-only cross-account position view for ADMIN users.

    PAPER positions come from paper_positions and LIVE positions come from
    trading_positions. No derived in-memory portfolio is used as the source
    of truth. Existing accounting/valuation services remain responsible for
    updating these persisted values.
    """

    def __init__(self, db: Session) -> None:
        self.db = db

    @staticmethod
    def _decimal(value) -> Decimal:
        return Decimal(str(value or 0))

    def list_positions(
        self,
        *,
        page: int = 1,
        page_size: int = 25,
        search: Optional[str] = None,
        execution_mode: Optional[str] = None,
        user_id: Optional[UUID] = None,
        broker_id: Optional[UUID] = None,
        strategy_instance_id: Optional[UUID] = None,
    ) -> AdminPositionListResponse:
        mode = execution_mode.upper() if execution_mode else None
        search_term = search.strip() if search else None

        common_filters = []
        if user_id:
            common_filters.append(User.id == user_id)
        if broker_id:
            common_filters.append(Broker.id == broker_id)
        if strategy_instance_id:
            common_filters.append(StrategyInstance.id == strategy_instance_id)
        if search_term:
            like = f"%{search_term}%"
            common_filters.append(
                or_(
                    PaperPosition.symbol.ilike(like),
                    TradingPosition.symbol.ilike(like),
                    User.full_name.ilike(like),
                    User.username.ilike(like),
                    User.email.ilike(like),
                    Broker.broker_name.ilike(like),
                    StrategyDefinition.name.ilike(like),
                )
            )

        paper_filters = [PaperPosition.quantity != 0]
        live_filters = [TradingPosition.quantity != 0]
        for condition in common_filters:
            # SQLAlchemy expressions reference both source tables; build the
            # applicable equivalent for each branch.
            text = str(condition)
            if "paper_positions" in text or "trading_positions" in text:
                if PaperPosition.symbol in getattr(condition, "left", []):
                    paper_filters.append(condition)
            else:
                paper_filters.append(condition)
                live_filters.append(condition)

        # Rebuild search/filter branches explicitly to avoid cross-table
        # expression leakage in UNION queries.
        paper_filters = [PaperPosition.quantity != 0]
        live_filters = [TradingPosition.quantity != 0]
        if user_id:
            paper_filters.append(PaperPosition.user_id == user_id)
            live_filters.append(TradingPosition.user_id == user_id)
        if broker_id:
            # PAPER has no broker column. A strategy-bound paper position can
            # still be mapped through its StrategyInstance broker.
            paper_filters.append(StrategyInstance.broker_id == broker_id)
            live_filters.append(TradingPosition.broker_id == broker_id)
        if strategy_instance_id:
            paper_filters.append(PaperPosition.strategy_instance_id == strategy_instance_id)
            live_filters.append(TradingPosition.strategy_instance_id == strategy_instance_id)
        if search_term:
            like = f"%{search_term}%"
            paper_filters.append(or_(PaperPosition.symbol.ilike(like), User.full_name.ilike(like), User.username.ilike(like), User.email.ilike(like), Broker.broker_name.ilike(like), StrategyDefinition.name.ilike(like)))
            live_filters.append(or_(TradingPosition.symbol.ilike(like), User.full_name.ilike(like), User.username.ilike(like), User.email.ilike(like), Broker.broker_name.ilike(like), StrategyDefinition.name.ilike(like)))

        paper_stmt = (
            select(
                PaperPosition.id.label("position_ref"), literal("PAPER_POSITION").label("source"),
                PaperPosition.user_id.label("user_id"), User.full_name.label("user_name"), User.role.label("user_role"),
                StrategyInstance.broker_id.label("broker_id"), Broker.broker_name.label("broker_name"),
                PaperPosition.strategy_instance_id.label("strategy_instance_id"), StrategyDefinition.name.label("strategy_name"),
                literal("PAPER").label("execution_mode"), PaperPosition.symbol, PaperPosition.quantity,
                PaperPosition.average_price, PaperPosition.last_price, PaperPosition.market_value,
                PaperPosition.realized_pnl, PaperPosition.unrealized_pnl, PaperPosition.valuation_at, PaperPosition.updated_at,
            )
            .join(User, User.id == PaperPosition.user_id)
            .outerjoin(StrategyInstance, StrategyInstance.id == PaperPosition.strategy_instance_id)
            .outerjoin(StrategyDefinition, StrategyDefinition.id == StrategyInstance.strategy_definition_id)
            .outerjoin(Broker, Broker.id == StrategyInstance.broker_id)
            .where(and_(*paper_filters))
        )

        live_stmt = (
            select(
                TradingPosition.id.label("position_ref"), literal("LIVE_POSITION").label("source"),
                TradingPosition.user_id.label("user_id"), User.full_name.label("user_name"), User.role.label("user_role"),
                TradingPosition.broker_id.label("broker_id"), Broker.broker_name.label("broker_name"),
                TradingPosition.strategy_instance_id.label("strategy_instance_id"), StrategyDefinition.name.label("strategy_name"),
                literal("LIVE").label("execution_mode"), TradingPosition.symbol, TradingPosition.quantity,
                TradingPosition.average_price, TradingPosition.last_price, TradingPosition.market_value,
                TradingPosition.realized_pnl, TradingPosition.unrealized_pnl, TradingPosition.valuation_at, TradingPosition.updated_at,
            )
            .join(User, User.id == TradingPosition.user_id)
            .outerjoin(StrategyInstance, StrategyInstance.id == TradingPosition.strategy_instance_id)
            .outerjoin(StrategyDefinition, StrategyDefinition.id == StrategyInstance.strategy_definition_id)
            .join(Broker, Broker.id == TradingPosition.broker_id)
            .where(and_(*live_filters))
        )

        if mode == "PAPER":
            combined = paper_stmt
        elif mode == "LIVE":
            combined = live_stmt
        else:
            combined = union_all(paper_stmt, live_stmt)

        subquery = combined.subquery("admin_positions")
        total = int(self.db.scalar(select(func.count()).select_from(subquery)) or 0)
        summary_row = self.db.execute(
            select(
                func.count().label("total_positions"),
                func.sum(case((subquery.c.execution_mode == "PAPER", 1), else_=0)).label("paper_positions"),
                func.sum(case((subquery.c.execution_mode == "LIVE", 1), else_=0)).label("live_positions"),
                func.coalesce(func.sum(subquery.c.market_value), 0).label("total_market_value"),
                func.coalesce(func.sum(subquery.c.realized_pnl), 0).label("realized_pnl"),
                func.coalesce(func.sum(subquery.c.unrealized_pnl), 0).label("unrealized_pnl"),
            )
            .select_from(subquery)
        ).one()

        offset = (page - 1) * page_size
        rows = self.db.execute(
            select(subquery).order_by(subquery.c.updated_at.desc()).offset(offset).limit(page_size)
        ).mappings().all()

        items = [
            AdminPositionItem(
                position_ref=str(row["position_ref"]), source=row["source"], user_id=str(row["user_id"]),
                user_name=row["user_name"] or "Unknown", user_role=str(getattr(row["user_role"], "value", row["user_role"])),
                broker_id=str(row["broker_id"]) if row["broker_id"] else None, broker_name=row["broker_name"],
                strategy_instance_id=str(row["strategy_instance_id"]) if row["strategy_instance_id"] else None,
                strategy_name=row["strategy_name"], execution_mode=row["execution_mode"], symbol=row["symbol"],
                quantity=str(row["quantity"]), average_price=str(row["average_price"]),
                last_price=str(row["last_price"]) if row["last_price"] is not None else None,
                market_value=str(row["market_value"]), realized_pnl=str(row["realized_pnl"]),
                unrealized_pnl=str(row["unrealized_pnl"]), valuation_at=row["valuation_at"], updated_at=row["updated_at"],
            ) for row in rows
        ]
        return AdminPositionListResponse(
            items=items, total=total, page=page, page_size=page_size,
            pages=ceil(total / page_size) if total else 0,
            summary=AdminPositionSummary(
                total_positions=total,
                paper_positions=int(summary_row.paper_positions or 0),
                live_positions=int(summary_row.live_positions or 0),
                total_market_value=str(summary_row.total_market_value or 0),
                realized_pnl=str(summary_row.realized_pnl or 0),
                unrealized_pnl=str(summary_row.unrealized_pnl or 0),
            ),
        )

    def get_position(self, position_ref: UUID, source: str) -> AdminPositionItem | None:
        mode = source.upper()
        model = PaperPosition if mode == "PAPER_POSITION" else TradingPosition if mode == "LIVE_POSITION" else None
        if model is None:
            return None
        position = self.db.get(model, position_ref)
        if not position or position.quantity == 0:
            return None
        user = self.db.get(User, position.user_id)
        broker_id = getattr(position, "broker_id", None)
        strategy_instance_id = position.strategy_instance_id
        if not broker_id and strategy_instance_id:
            strategy_instance = self.db.get(StrategyInstance, strategy_instance_id)
            broker_id = strategy_instance.broker_id if strategy_instance else None
        broker = self.db.get(Broker, broker_id) if broker_id else None
        strategy_name = None
        if strategy_instance_id:
            strategy_instance = self.db.get(StrategyInstance, strategy_instance_id)
            if strategy_instance:
                definition = self.db.get(StrategyDefinition, strategy_instance.strategy_definition_id)
                strategy_name = definition.name if definition else None
        return AdminPositionItem(
            position_ref=str(position.id), source=mode, user_id=str(position.user_id),
            user_name=user.full_name if user else "Unknown", user_role=str(getattr(user.role, "value", user.role)) if user else "UNKNOWN",
            broker_id=str(broker_id) if broker_id else None, broker_name=broker.broker_name if broker else None,
            strategy_instance_id=str(strategy_instance_id) if strategy_instance_id else None, strategy_name=strategy_name,
            execution_mode="PAPER" if mode == "PAPER_POSITION" else "LIVE", symbol=position.symbol,
            quantity=str(position.quantity), average_price=str(position.average_price),
            last_price=str(position.last_price) if position.last_price is not None else None,
            market_value=str(position.market_value), realized_pnl=str(position.realized_pnl),
            unrealized_pnl=str(position.unrealized_pnl), valuation_at=position.valuation_at, updated_at=position.updated_at,
        )
