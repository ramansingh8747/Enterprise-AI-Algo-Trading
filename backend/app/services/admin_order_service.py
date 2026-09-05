from __future__ import annotations

from datetime import datetime, timezone
from math import ceil
from typing import Optional
from uuid import UUID

from sqlalchemy import DateTime, Numeric, String, and_, cast, func, literal, or_, select, union_all
from sqlalchemy.orm import Session

from app.database.models.broker import Broker
from app.database.models.broker_order import BrokerOrderRecord
from app.database.models.trading_execution import TradingExecution
from app.database.models.user import User, UserRole
from app.schemas.admin_orders import AdminOrderItem, AdminOrderListResponse


class AdminOrderService:
    """Read-only, cross-account order view for ADMIN users.

    Surfaces authentic TRADER orders directly from the central database, ensuring
    Admin remains strictly read-only and reflects the live Trader Order Book.
    """

    def __init__(self, db: Session) -> None:
        self.db = db

    def list_orders(
        self,
        *,
        page: int = 1,
        page_size: int = 25,
        search: Optional[str] = None,
        execution_mode: Optional[str] = None,
        status: Optional[str] = None,
        side: Optional[str] = None,
    ) -> AdminOrderListResponse:
        mode = execution_mode.upper() if execution_mode else None
        normalized_status = status.upper() if status else None
        normalized_side = side.upper() if side else None
        search_term = search.strip() if search else None

        execution_mode_subquery = (
            select(TradingExecution.execution_mode)
            .where(TradingExecution.broker_order_record_id == BrokerOrderRecord.id)
            .order_by(TradingExecution.executed_at.desc())
            .limit(1)
            .scalar_subquery()
        )

        live_filters = []
        if normalized_status:
            live_filters.append(BrokerOrderRecord.status == normalized_status)
        if normalized_side:
            live_filters.append(BrokerOrderRecord.side == normalized_side.lower())
        if search_term:
            like = f"%{search_term}%"
            live_filters.append(
                or_(
                    BrokerOrderRecord.symbol.ilike(like),
                    BrokerOrderRecord.broker_order_id.ilike(like),
                    User.full_name.ilike(like),
                    User.username.ilike(like),
                    User.email.ilike(like),
                    Broker.broker_name.ilike(like),
                )
            )

        live_stmt = (
            select(
                BrokerOrderRecord.id.label("ref_id"),
                literal("BROKER_ORDER").label("source"),
                BrokerOrderRecord.user_id.label("user_id"),
                User.full_name.label("user_name"),
                User.role.label("user_role"),
                BrokerOrderRecord.broker_id.label("broker_id"),
                Broker.broker_name.label("broker_name"),
                func.coalesce(execution_mode_subquery, literal("LIVE")).label("execution_mode"),
                BrokerOrderRecord.symbol,
                BrokerOrderRecord.side,
                BrokerOrderRecord.quantity,
                BrokerOrderRecord.filled_quantity,
                BrokerOrderRecord.average_fill_price,
                BrokerOrderRecord.order_type,
                BrokerOrderRecord.product,
                BrokerOrderRecord.price,
                BrokerOrderRecord.trigger_price,
                BrokerOrderRecord.status,
                BrokerOrderRecord.strategy_instance_id,
                BrokerOrderRecord.signal_id,
                cast(None, String).label("execution_id"),
                BrokerOrderRecord.broker_updated_at.label("executed_at"),
                BrokerOrderRecord.last_broker_sync_at.label("last_synced_at"),
                BrokerOrderRecord.created_at,
                BrokerOrderRecord.updated_at,
            )
            .join(User, User.id == BrokerOrderRecord.user_id)
            .join(Broker, Broker.id == BrokerOrderRecord.broker_id)
            .where(and_(*live_filters))
        )

        paper_filters = [
            TradingExecution.execution_mode == "PAPER",
            TradingExecution.broker_order_record_id.is_(None),
        ]
        if normalized_status:
            paper_filters.append(TradingExecution.id == UUID(int=0) if normalized_status != "FILLED" else True)
        if normalized_side:
            paper_filters.append(TradingExecution.side == normalized_side)
        if search_term:
            like = f"%{search_term}%"
            paper_filters.append(
                or_(
                    TradingExecution.symbol.ilike(like),
                    TradingExecution.external_execution_id.ilike(like),
                    User.full_name.ilike(like),
                    User.username.ilike(like),
                    User.email.ilike(like),
                )
            )

        paper_stmt = (
            select(
                TradingExecution.id.label("ref_id"),
                literal("PAPER_EXECUTION").label("source"),
                TradingExecution.user_id.label("user_id"),
                User.full_name.label("user_name"),
                User.role.label("user_role"),
                TradingExecution.broker_id.label("broker_id"),
                Broker.broker_name.label("broker_name"),
                TradingExecution.execution_mode.label("execution_mode"),
                TradingExecution.symbol,
                TradingExecution.side,
                TradingExecution.quantity,
                TradingExecution.quantity.label("filled_quantity"),
                TradingExecution.price.label("average_fill_price"),
                literal("MARKET").label("order_type"),
                cast(None, String).label("product"),
                TradingExecution.price.label("price"),
                cast(None, Numeric(20, 8)).label("trigger_price"),
                literal("FILLED").label("status"),
                TradingExecution.strategy_instance_id,
                TradingExecution.signal_id,
                cast(TradingExecution.id, String).label("execution_id"),
                TradingExecution.executed_at,
                cast(None, DateTime(timezone=True)).label("last_synced_at"),
                TradingExecution.created_at,
                TradingExecution.created_at.label("updated_at"),
            )
            .join(User, User.id == TradingExecution.user_id)
            .outerjoin(Broker, Broker.id == TradingExecution.broker_id)
            .where(and_(*paper_filters))
        )

        if mode == "PAPER":
            combined = paper_stmt
        elif mode == "LIVE":
            combined = live_stmt.where(or_(execution_mode_subquery == "LIVE", execution_mode_subquery.is_(None)))
        else:
            combined = union_all(live_stmt, paper_stmt)

        subquery = combined.subquery("admin_orders")
        total = int(self.db.scalar(select(func.count()).select_from(subquery)) or 0)
        offset = (page - 1) * page_size
        rows = self.db.execute(
            select(subquery)
            .order_by(subquery.c.updated_at.desc())
            .offset(offset)
            .limit(page_size)
        ).mappings().all()

        items = [self._row_to_item(row) for row in rows]
        pages = ceil(total / page_size) if total else 0
        return AdminOrderListResponse(items=items, total=total, page=page, page_size=page_size, pages=pages)

    def get_order(self, order_ref: UUID) -> AdminOrderItem | None:
        record = self.db.get(BrokerOrderRecord, order_ref)
        if record:
            user = self.db.get(User, record.user_id)
            broker = self.db.get(Broker, record.broker_id)
            execution = self.db.execute(
                select(TradingExecution)
                .where(TradingExecution.broker_order_record_id == record.id)
                .order_by(TradingExecution.executed_at.desc())
                .limit(1)
            ).scalar_one_or_none()
            return AdminOrderItem(
                order_ref=str(record.id), source="BROKER_ORDER", user_id=str(record.user_id),
                user_name=user.full_name if user else "Unknown", user_role=str(user.role.value if user else "UNKNOWN"),
                broker_id=str(record.broker_id), broker_name=broker.broker_name if broker else None,
                execution_mode=execution.execution_mode if execution else "LIVE",
                symbol=record.symbol, side=record.side.upper(), quantity=record.quantity,
                filled_quantity=record.filled_quantity, average_fill_price=record.average_fill_price,
                order_type=record.order_type, product=record.product, price=record.price,
                trigger_price=record.trigger_price, status=record.status,
                strategy_instance_id=str(record.strategy_instance_id) if record.strategy_instance_id else None,
                signal_id=str(record.signal_id) if record.signal_id else None,
                execution_id=str(execution.id) if execution else None,
                executed_at=execution.executed_at if execution else record.broker_updated_at,
                last_synced_at=record.last_broker_sync_at, created_at=record.created_at, updated_at=record.updated_at,
            )

        execution = self.db.get(TradingExecution, order_ref)
        if not execution or execution.execution_mode != "PAPER" or execution.broker_order_record_id is not None:
            return None
        user = self.db.get(User, execution.user_id)
        broker = self.db.get(Broker, execution.broker_id) if execution.broker_id else None
        return AdminOrderItem(
            order_ref=str(execution.id), source="PAPER_EXECUTION", user_id=str(execution.user_id),
            user_name=user.full_name if user else "Unknown", user_role=str(user.role.value if user else "UNKNOWN"),
            broker_id=str(execution.broker_id) if execution.broker_id else None,
            broker_name=broker.broker_name if broker else None, execution_mode="PAPER",
            symbol=execution.symbol, side=execution.side.upper(), quantity=execution.quantity,
            filled_quantity=execution.quantity, average_fill_price=execution.price, order_type="MARKET",
            product=None, price=execution.price, trigger_price=None, status="FILLED",
            strategy_instance_id=str(execution.strategy_instance_id) if execution.strategy_instance_id else None,
            signal_id=str(execution.signal_id) if execution.signal_id else None,
            execution_id=str(execution.id), executed_at=execution.executed_at, last_synced_at=None,
            created_at=execution.created_at, updated_at=execution.created_at,
        )

    @staticmethod
    def _row_to_item(row) -> AdminOrderItem:
        role = row["user_role"]
        role_value = getattr(role, "value", role)
        return AdminOrderItem(
            order_ref=str(row["ref_id"]), source=row["source"], user_id=str(row["user_id"]),
            user_name=row["user_name"], user_role=str(role_value),
            broker_id=str(row["broker_id"]) if row["broker_id"] else None,
            broker_name=row["broker_name"], execution_mode=str(row["execution_mode"] or "UNKNOWN").upper(),
            symbol=row["symbol"], side=str(row["side"]).upper(), quantity=row["quantity"],
            filled_quantity=row["filled_quantity"], average_fill_price=row["average_fill_price"],
            order_type=row["order_type"], product=row["product"], price=row["price"],
            trigger_price=row["trigger_price"], status=str(row["status"]).upper(),
            strategy_instance_id=str(row["strategy_instance_id"]) if row["strategy_instance_id"] else None,
            signal_id=str(row["signal_id"]) if row["signal_id"] else None,
            execution_id=str(row["execution_id"]) if row["execution_id"] else None,
            executed_at=row["executed_at"], last_synced_at=row["last_synced_at"],
            created_at=row["created_at"], updated_at=row["updated_at"],
        )
