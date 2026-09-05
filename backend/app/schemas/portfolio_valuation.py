from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class PortfolioValuationResponse(BaseModel):
    execution_mode: str
    user_id: UUID
    broker_id: Optional[UUID] = None
    paper_portfolio_id: Optional[UUID] = None
    cash_balance: Optional[Decimal] = None
    market_value: Decimal
    realized_pnl: Decimal
    unrealized_pnl: Decimal
    total_pnl: Decimal
    equity: Decimal
    position_count: int
    valued_at: datetime
