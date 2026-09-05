from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.models.trading_execution import TradingExecution, TradingPosition
from app.database.repositories.base_repository import BaseRepository


class TradingExecutionRepository(BaseRepository[TradingExecution]):
    def __init__(self, db: Session) -> None:
        super().__init__(TradingExecution, db)

    def get_by_external_id(self, execution_mode: str, broker_id: Optional[UUID], external_execution_id: str) -> Optional[TradingExecution]:
        stmt = select(TradingExecution).where(
            TradingExecution.execution_mode == execution_mode,
            TradingExecution.broker_id == broker_id,
            TradingExecution.external_execution_id == external_execution_id,
        )
        return self.db.scalars(stmt).first()

    def list_for_order(self, broker_order_record_id: UUID) -> list[TradingExecution]:
        stmt = select(TradingExecution).where(
            TradingExecution.broker_order_record_id == broker_order_record_id
        ).order_by(TradingExecution.executed_at.asc(), TradingExecution.created_at.asc())
        return list(self.db.scalars(stmt).all())

    def list_for_account(self, user_id: UUID, broker_id: UUID, limit: int = 100) -> list[TradingExecution]:
        stmt = select(TradingExecution).where(
            TradingExecution.user_id == user_id,
            TradingExecution.broker_id == broker_id,
        ).order_by(TradingExecution.executed_at.desc()).limit(limit)
        return list(self.db.scalars(stmt).all())

    def list_paper_for_user(self, user_id: UUID, limit: int = 100) -> list[TradingExecution]:
        """Return persisted PAPER executions for the user."""
        stmt = (
            select(TradingExecution)
            .where(
                TradingExecution.user_id == user_id,
                TradingExecution.execution_mode == "PAPER",
            )
            .order_by(TradingExecution.executed_at.desc())
            .limit(limit)
        )
        return list(self.db.scalars(stmt).all())


class TradingPositionRepository(BaseRepository[TradingPosition]):
    def __init__(self, db: Session) -> None:
        super().__init__(TradingPosition, db)

    def get_for_update(self, user_id: UUID, broker_id: UUID, symbol: str) -> Optional[TradingPosition]:
        stmt = select(TradingPosition).where(
            TradingPosition.user_id == user_id,
            TradingPosition.broker_id == broker_id,
            TradingPosition.symbol == symbol.upper(),
        ).with_for_update()
        return self.db.scalars(stmt).first()

    def list_for_account(self, user_id: UUID, broker_id: UUID) -> list[TradingPosition]:
        stmt = select(TradingPosition).where(
            TradingPosition.user_id == user_id,
            TradingPosition.broker_id == broker_id,
            TradingPosition.quantity != 0,
        ).order_by(TradingPosition.symbol.asc())
        return list(self.db.scalars(stmt).all())

    def list_all_open_with_stop_loss(self) -> list[TradingPosition]:
        stmt = select(TradingPosition).where(
            TradingPosition.quantity != 0,
            TradingPosition.stop_loss.isnot(None),
            TradingPosition.status == "OPEN",
        )
        return list(self.db.scalars(stmt).all())

    def list_all_open(self, user_id: UUID) -> list[TradingPosition]:
        stmt = select(TradingPosition).where(
            TradingPosition.user_id == user_id,
            TradingPosition.quantity != 0,
            TradingPosition.status == "OPEN",
        ).order_by(TradingPosition.symbol.asc())
        return list(self.db.scalars(stmt).all())
