from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime

class TradingJournalEntryBase(BaseModel):
    symbol: str
    side: str
    quantity: float
    entry_price: float
    exit_price: Optional[float] = None
    realized_pnl: Optional[float] = None
    result: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[str] = None
    paper_trade_id: Optional[str] = None
    broker_order_id: Optional[str] = None
    strategy_instance_id: Optional[UUID] = None
    strategy_signal_id: Optional[UUID] = None

class TradingJournalEntryCreate(TradingJournalEntryBase):
    pass

class TradingJournalEntryUpdate(TradingJournalEntryBase):
    pass

class TradingJournalEntryResponse(TradingJournalEntryBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

