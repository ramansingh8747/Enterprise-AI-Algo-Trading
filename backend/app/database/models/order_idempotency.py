import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

if TYPE_CHECKING:
    from app.database.models.user import User
    from app.database.models.broker import Broker


class OrderIdempotencyRecord(Base):
    """
    SQLAlchemy ORM model representing an order idempotency record.
    Prevents duplicate broker order execution for the same (user_id, broker_id, idempotency_key).
    """

    __tablename__ = "order_idempotency_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    broker_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("brokers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    idempotency_key: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    request_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="PENDING",
    )
    order_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    response_payload: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Scoped uniqueness: (user_id, broker_id, idempotency_key)
    __table_args__ = (
        UniqueConstraint("user_id", "broker_id", "idempotency_key", name="uq_user_broker_idempotency_key"),
    )

    # Relationships
    user: Mapped["User"] = relationship("User")
    broker: Mapped["Broker"] = relationship("Broker")

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<OrderIdempotencyRecord id={self.id} key={self.idempotency_key} "
            f"user_id={self.user_id} broker_id={self.broker_id} status={self.status}>"
        )
