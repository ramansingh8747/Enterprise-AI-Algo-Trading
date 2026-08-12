from typing import Optional
from uuid import UUID
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.database.repositories.base_repository import BaseRepository
from app.database.models.trading_risk_settings import TradingRiskSettings
from app.database.models.order_idempotency import OrderIdempotencyRecord


class TradingRiskRepository(BaseRepository[TradingRiskSettings]):
    """Repository managing persistence for trading risk guardrails and settings."""

    def __init__(self, db: Session) -> None:
        super().__init__(model=TradingRiskSettings, db=db)

    def get_risk_settings(
        self,
        user_id: Optional[UUID] = None,
        broker_id: Optional[UUID] = None,
    ) -> TradingRiskSettings:
        """
        Retrieves scoped risk settings for a user/broker combo, falling back to global defaults.
        If no settings exist in DB, creates and commits default global settings.
        """
        # Try user + broker specific settings first
        if user_id and broker_id:
            stmt = select(TradingRiskSettings).where(
                TradingRiskSettings.user_id == user_id,
                TradingRiskSettings.broker_id == broker_id,
            )
            settings = self.db.execute(stmt).scalar_one_or_none()
            if settings:
                return settings

        # Try user-specific settings next
        if user_id:
            stmt = select(TradingRiskSettings).where(
                TradingRiskSettings.user_id == user_id,
                TradingRiskSettings.broker_id.is_(None),
            )
            settings = self.db.execute(stmt).scalar_one_or_none()
            if settings:
                return settings

        # Global settings (user_id IS NULL AND broker_id IS NULL)
        stmt = select(TradingRiskSettings).where(
            TradingRiskSettings.user_id.is_(None),
            TradingRiskSettings.broker_id.is_(None),
        )
        settings = self.db.execute(stmt).scalar_one_or_none()

        if not settings:
            settings = TradingRiskSettings(
                user_id=None,
                broker_id=None,
                max_order_quantity=Decimal("1000.0000"),
                max_order_notional=Decimal("500000.0000"),
                max_position_quantity=Decimal("5000.0000"),
                max_exposure_notional=Decimal("2000000.0000"),
                max_orders_per_minute=10,
                daily_loss_limit=Decimal("50000.0000"),
                max_drawdown_percent=Decimal("10.0000"),
                kill_switch_active=False,
            )
            self.db.add(settings)
            self.db.commit()
            self.db.refresh(settings)

        return settings

    def count_recent_orders_in_window(
        self,
        user_id: UUID,
        broker_id: UUID,
        window_seconds: int = 60,
    ) -> int:
        """Counts total order attempts for a user & broker within the last window_seconds."""
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=window_seconds)
        stmt = select(func.count(OrderIdempotencyRecord.id)).where(
            OrderIdempotencyRecord.user_id == user_id,
            OrderIdempotencyRecord.broker_id == broker_id,
            OrderIdempotencyRecord.created_at >= cutoff,
        )
        return self.db.execute(stmt).scalar_one() or 0

    def set_kill_switch(
        self,
        active: bool,
        user_id: Optional[UUID] = None,
        broker_id: Optional[UUID] = None,
    ) -> TradingRiskSettings:
        """Sets emergency kill switch status globally or for a specific user/broker."""
        settings = self.get_risk_settings(user_id=user_id, broker_id=broker_id)
        settings.kill_switch_active = active
        self.db.commit()
        self.db.refresh(settings)
        return settings
