from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class AdminOrderItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    order_ref: str
    source: str
    user_id: str
    user_name: str
    user_role: str
    broker_id: Optional[str] = None
    broker_name: Optional[str] = None
    execution_mode: str
    symbol: str
    side: str
    quantity: Decimal
    filled_quantity: Decimal
    average_fill_price: Optional[Decimal] = None
    order_type: Optional[str] = None
    product: Optional[str] = None
    price: Optional[Decimal] = None
    trigger_price: Optional[Decimal] = None
    status: str
    strategy_instance_id: Optional[str] = None
    signal_id: Optional[str] = None
    execution_id: Optional[str] = None
    executed_at: Optional[datetime] = None
    last_synced_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class AdminOrderListResponse(BaseModel):
    items: list[AdminOrderItem]
    total: int
    page: int
    page_size: int
    pages: int


class AdminOrderListQuery(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=25, ge=1, le=100)
    search: Optional[str] = Field(default=None, max_length=100)
    execution_mode: Optional[str] = Field(default=None, pattern=r"^(?i)(PAPER|LIVE)$")
    status: Optional[str] = Field(default=None, max_length=30)
    side: Optional[str] = Field(default=None, pattern=r"^(?i)(BUY|SELL)$")
