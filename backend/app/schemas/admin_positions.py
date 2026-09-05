from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class AdminPositionItem(BaseModel):
    position_ref: str
    source: str
    user_id: str
    user_name: str
    user_role: str
    broker_id: Optional[str] = None
    broker_name: Optional[str] = None
    strategy_instance_id: Optional[str] = None
    strategy_name: Optional[str] = None
    execution_mode: str
    symbol: str
    quantity: str
    average_price: str
    last_price: Optional[str] = None
    market_value: str
    realized_pnl: str
    unrealized_pnl: str
    valuation_at: Optional[datetime] = None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminPositionSummary(BaseModel):
    total_positions: int
    paper_positions: int
    live_positions: int
    total_market_value: str
    realized_pnl: str
    unrealized_pnl: str


class AdminPositionListResponse(BaseModel):
    items: list[AdminPositionItem]
    total: int
    page: int
    page_size: int
    pages: int
    summary: AdminPositionSummary
