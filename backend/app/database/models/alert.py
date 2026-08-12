import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database.base import Base

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(50), nullable=False, default="SYSTEM") # SYSTEM, RISK, BROKER, ORDER, STRATEGY
    severity = Column(String(20), nullable=False, default="INFO") # INFO, SUCCESS, WARNING, DANGER
    title = Column(String(150), nullable=False)
    message = Column(String, nullable=False)
    read = Column(Boolean, nullable=False, default=False)
    route = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
