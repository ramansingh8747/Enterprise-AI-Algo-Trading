from __future__ import annotations

from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class AdminPortfolioItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    portfolio_ref: UUID
    source: str
    execution_mode: str
    user_id: UUID
    user_name: str
    user_role: str
    broker_id: Optional[UUID] = None
    broker_name: Optional[str] = None
    strategy_instance_id: Optional[UUID] = None
    strategy_name: Optional[str] = None
    currency: str = "INR"
    initial_balance: Optional[str] = None
    cash_balance: Optional[str] = None
    invested_value: str
    market_value: str
    realized_pnl: str
    unrealized_pnl: str
    total_pnl: str
    equity: str
    position_count: int
    valuation_at: Optional[str] = None
    updated_at: str


class AdminPortfolioSummary(BaseModel):
    total_accounts: int
    paper_accounts: int
    live_accounts: int
    total_cash_balance: str
    total_invested_value: str
    total_market_value: str
    realized_pnl: str
    unrealized_pnl: str
    total_pnl: str
    total_equity: str


class AdminPortfolioListResponse(BaseModel):
    items: List[AdminPortfolioItem]
    total: int
    page: int
    page_size: int
    pages: int
    summary: AdminPortfolioSummary
