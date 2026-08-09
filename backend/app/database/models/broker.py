import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class Broker(Base):
    """
    SQLAlchemy ORM model representing an external trading broker.
    """

    __tablename__ = "brokers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    broker_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    broker_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )
    api_key: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    api_secret: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    client_id: Mapped[str] = mapped_column(
        String(255),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
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

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Broker name={self.broker_name} type={self.broker_type}>"
