from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict


class AdminOverviewMetrics(BaseModel):
    model_config = ConfigDict(extra="forbid")

    total_users: int
    active_users: int
    admin_users: int
    total_brokers: int
    active_brokers: int
    connected_brokers: int
    total_orders: int
    open_orders: int
    today_orders: int
    total_strategies: int
    running_strategies: int
    paper_portfolios: int
    open_paper_positions: int
    paper_realized_pnl: Decimal
    paper_unrealized_pnl: Decimal
    kill_switch_active: bool


class AdminOverviewResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    generated_at: datetime
    overall_status: Literal["UP", "DEGRADED", "DOWN"]
    metrics: AdminOverviewMetrics
    live_trading_enabled: bool
    strategy_scheduler_enabled: bool
