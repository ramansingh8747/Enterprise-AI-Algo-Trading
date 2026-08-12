import uuid
from datetime import datetime, timezone
from typing import Optional
from decimal import Decimal
from sqlalchemy import String, DateTime, Boolean, Numeric, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database.base import Base


class TradingRiskSettings(Base):
    """ORM model for trading risk limits, guardrails, and emergency kill switch settings."""

    __tablename__ = "trading_risk_settings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    broker_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("brokers.id", ondelete="CASCADE"), nullable=True, index=True
    )

    max_order_quantity: Mapped[Decimal] = mapped_column(
        Numeric(18, 4), nullable=False, default=Decimal("1000.0000")
    )
    max_order_notional: Mapped[Decimal] = mapped_column(
        Numeric(18, 4), nullable=False, default=Decimal("500000.0000")
    )
    max_position_quantity: Mapped[Decimal] = mapped_column(
        Numeric(18, 4), nullable=False, default=Decimal("5000.0000")
    )
    max_exposure_notional: Mapped[Decimal] = mapped_column(
        Numeric(18, 4), nullable=False, default=Decimal("2000000.0000")
    )
    max_orders_per_minute: Mapped[int] = mapped_column(
        nullable=False, default=10
    )
    daily_loss_limit: Mapped[Decimal] = mapped_column(
        Numeric(18, 4), nullable=False, default=Decimal("50000.0000")
    )
    max_drawdown_percent: Mapped[Decimal] = mapped_column(
        Numeric(18, 4), nullable=False, default=Decimal("10.0000")
    )
    kill_switch_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
