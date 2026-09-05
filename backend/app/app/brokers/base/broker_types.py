from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal

class BrokerProfile(BaseModel):
    account_id: str
    account_type: Optional[str] = None
    currency: Optional[str] = None

class BrokerHolding(BaseModel):
    symbol: str
    quantity: Decimal
    average_price: Optional[Decimal]

class BrokerPosition(BaseModel):
    symbol: str
    quantity: Decimal
    side: str  # e.g., 'buy' or 'sell'
    avg_price: Decimal

class BrokerOrder(BaseModel):
    order_id: str
    symbol: str
    side: str
    quantity: Decimal
    status: str
    exchange: Optional[str] = None
    filled_quantity: Decimal = Decimal("0")
    average_fill_price: Optional[Decimal] = None
    order_type: Optional[str] = None
    product: Optional[str] = None
    variety: Optional[str] = None
    price: Optional[Decimal] = None
    trigger_price: Optional[Decimal] = None
    broker_created_at: Optional[datetime] = None
    broker_updated_at: Optional[datetime] = None

class BrokerOrderActionResult(BaseModel):
    order_id: str
    success: bool

class BrokerCancelOrderRequest(BaseModel):
    order_id: str
    variety: str
    parent_order_id: Optional[str] = None

class BrokerOrderRequest(BaseModel):
    symbol: str
    exchange: str
    quantity: Decimal
    side: str
    order_type: str
    product: str
    variety: str
    price: Optional[Decimal] = None
    trigger_price: Optional[Decimal] = None

class BrokerQuote(BaseModel):
    symbol: str
    bid: Decimal
    ask: Decimal
    last_price: Decimal
    change_percent: Optional[Decimal] = None
