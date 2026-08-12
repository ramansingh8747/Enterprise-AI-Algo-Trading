from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.database.base import Base

class TradingJournalEntry(Base):
    __tablename__ = "trading_journal"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    symbol = Column(String, nullable=False, index=True)
    side = Column(String, nullable=False)
    quantity = Column(Float, nullable=False) # Should be Decimal in production, but Float is used in existing types/service
    entry_price = Column(Float, nullable=False)
    exit_price = Column(Float, nullable=True)
    realized_pnl = Column(Float, nullable=True)
    result = Column(String, nullable=True) # WIN, LOSS, OPEN
    notes = Column(String, nullable=True)
    tags = Column(String, nullable=True)
    paper_trade_id = Column(String, nullable=True, index=True)
    broker_order_id = Column(String, nullable=True, index=True)
    strategy_instance_id = Column(UUID(as_uuid=True), ForeignKey("strategy_instances.id", ondelete="SET NULL"), nullable=True, index=True)
    strategy_signal_id = Column(UUID(as_uuid=True), ForeignKey("strategy_signals.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

