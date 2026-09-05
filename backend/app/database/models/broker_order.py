import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

if TYPE_CHECKING:
    from app.database.models.user import User
    from app.database.models.broker import Broker
    from app.database.models.strategy import StrategyInstance, StrategySignal


class BrokerOrderRecord(Base):
    """Application-owned order ledger reconciled against broker state."""

    __tablename__ = "broker_order_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    broker_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("brokers.id", ondelete="CASCADE"), nullable=False, index=True)
    broker_order_id: Mapped[str] = mapped_column(String(255), nullable=False)
    strategy_instance_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("strategy_instances.id", ondelete="SET NULL"), nullable=True, index=True)
    signal_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("strategy_signals.id", ondelete="SET NULL"), nullable=True, index=True)
    symbol: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    exchange: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    side: Mapped[str] = mapped_column(String(10), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False)
    filled_quantity: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False, default=Decimal("0"))
    average_fill_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8), nullable=True)
    order_type: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    product: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    variety: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    price: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8), nullable=True)
    trigger_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    order_source: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, default="MANUAL_BUY")
    last_broker_sync_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), index=True)
    broker_created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    broker_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    raw_payload: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("broker_id", "broker_order_id", name="uq_broker_order_records_broker_order"),
    )

    user: Mapped["User"] = relationship("User")
    broker: Mapped["Broker"] = relationship("Broker")
    strategy_instance: Mapped[Optional["StrategyInstance"]] = relationship("StrategyInstance")
    signal: Mapped[Optional["StrategySignal"]] = relationship("StrategySignal")
