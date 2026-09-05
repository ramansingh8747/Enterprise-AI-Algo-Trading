from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class PaperPositionResponse(BaseModel):
    """API Response model for a single PaperPosition."""

    id: UUID
    paper_portfolio_id: UUID
    user_id: UUID
    strategy_instance_id: Optional[UUID] = None
    symbol: str
    quantity: Decimal = Field(description="Open position quantity using Decimal precision.")
    average_price: Decimal = Field(description="Average entry price using Decimal precision.")
    cost_basis: Decimal = Field(description="Cost basis using Decimal precision.")
    realized_pnl: Decimal = Field(description="Cumulative realized P&L using Decimal precision.")
    unrealized_pnl: Decimal = Field(description="Current unrealized P&L using Decimal precision.")
    last_price: Optional[Decimal] = None
    market_value: Decimal = Decimal("0.0000")
    valuation_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaperPortfolioResponse(BaseModel):
    """API Response model for a PaperPortfolio header."""

    id: UUID
    user_id: UUID
    strategy_instance_id: Optional[UUID] = None
    name: str
    execution_mode: str = "PAPER"
    initial_balance: Optional[Decimal] = Decimal("0.0000")
    cash_balance: Optional[Decimal] = Decimal("0.0000")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaperPortfolioSummaryResponse(BaseModel):
    """API Response model summarizing financial metrics for a PaperPortfolio."""

    paper_portfolio_id: UUID
    user_id: UUID
    execution_mode: str = "PAPER"
    total_realized_pnl: Decimal = Field(description="Sum of all position realized P&L.")
    total_unrealized_pnl: Decimal = Field(description="Sum of all position unrealized P&L.")
    total_pnl: Decimal = Field(description="Total portfolio P&L (Realized + Unrealized).")
    position_count: int = Field(description="Total number of positions in portfolio.")
    today_realized_pnl: Decimal = Field(default=Decimal("0.0000"), description="Realized P&L closed today (resets daily at 00:00 IST).")
    today_unrealized_pnl: Decimal = Field(default=Decimal("0.0000"), description="Unrealized P&L for today's active positions.")
    today_total_pnl: Decimal = Field(default=Decimal("0.0000"), description="Total P&L for today (Today Realized + Today Unrealized).")
    today_trades_count: int = Field(default=0, description="Total executions completed today.")
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PaperPortfolioCreateRequest(BaseModel):
    """API Request payload to create or initialize a PaperPortfolio."""

    name: Optional[str] = Field(default="Default Paper Portfolio", max_length=128)
    strategy_instance_id: Optional[UUID] = None
