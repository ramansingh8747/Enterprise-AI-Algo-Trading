import uuid
from datetime import datetime, timezone
from typing import Optional
from decimal import Decimal
from sqlalchemy import String, DateTime, Numeric, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

from app.database.base import Base


class PaperPortfolio(Base):
    """ORM model representing a dedicated server-side paper trading portfolio account."""

    __tablename__ = "paper_portfolios"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    strategy_instance_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("strategy_instances.id", ondelete="SET NULL"), nullable=True, index=True
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False, default="Default Paper Portfolio")
    execution_mode: Mapped[str] = mapped_column(String(32), nullable=False, default="PAPER")
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="INR")

    initial_balance: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("1000000.0000"))
    cash_balance: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("1000000.0000"))
    realized_pnl: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0.0000"))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def __init__(self, **kwargs) -> None:
        if "id" not in kwargs or kwargs["id"] is None:
            kwargs["id"] = uuid.uuid4()
        if "execution_mode" not in kwargs:
            kwargs["execution_mode"] = "PAPER"
        if "currency" not in kwargs:
            kwargs["currency"] = "INR"
        if "initial_balance" not in kwargs:
            kwargs["initial_balance"] = Decimal("1000000.0000")
        if "cash_balance" not in kwargs:
            kwargs["cash_balance"] = Decimal("1000000.0000")
        if "realized_pnl" not in kwargs:
            kwargs["realized_pnl"] = Decimal("0.0000")
        super().__init__(**kwargs)


class PaperPosition(Base):
    """ORM model representing open/closed paper symbol positions with Decimal accounting precision."""

    __tablename__ = "paper_positions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    paper_portfolio_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("paper_portfolios.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    strategy_instance_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("strategy_instances.id", ondelete="SET NULL"), nullable=True, index=True
    )

    symbol: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0.0000"))
    average_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0.0000"))
    cost_basis: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0.0000"))
    realized_pnl: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0.0000"))
    unrealized_pnl: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0.0000"))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint("paper_portfolio_id", "symbol", name="uq_paper_portfolio_symbol"),
    )

    def __init__(self, **kwargs) -> None:
        if "id" not in kwargs or kwargs["id"] is None:
            kwargs["id"] = uuid.uuid4()
        if "quantity" not in kwargs:
            kwargs["quantity"] = Decimal("0.0000")
        if "average_price" not in kwargs:
            kwargs["average_price"] = Decimal("0.0000")
        if "cost_basis" not in kwargs:
            kwargs["cost_basis"] = Decimal("0.0000")
        if "realized_pnl" not in kwargs:
            kwargs["realized_pnl"] = Decimal("0.0000")
        if "unrealized_pnl" not in kwargs:
            kwargs["unrealized_pnl"] = Decimal("0.0000")
        super().__init__(**kwargs)
