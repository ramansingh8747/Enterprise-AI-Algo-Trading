from typing import Optional
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict

from app.brokers.base.broker_types import (
    BrokerOrderRequest, BrokerCancelOrderRequest, BrokerOrder, BrokerOrderActionResult
)


class BrokerOrderCreateRequest(BaseModel):
    """Schema for placing a new broker order."""
    symbol: str = Field(..., min_length=1, description="Trading symbol e.g., INFY")
    exchange: str = Field(..., min_length=1, description="Exchange code e.g., NSE")
    quantity: Decimal = Field(..., gt=0, description="Order quantity")
    side: str = Field(..., min_length=1, description="Transaction side: BUY or SELL")
    order_type: str = Field(..., min_length=1, description="Order type e.g., LIMIT, MARKET")
    product: str = Field(..., min_length=1, description="Product code e.g., CNC, MIS")
    variety: str = Field("regular", min_length=1, description="Order variety e.g., regular")
    price: Optional[Decimal] = Field(None, ge=0, description="Limit price")
    trigger_price: Optional[Decimal] = Field(None, ge=0, description="Trigger price")

    def to_domain_request(self) -> BrokerOrderRequest:
        """Convert API schema to domain BrokerOrderRequest."""
        return BrokerOrderRequest(
            symbol=self.symbol,
            exchange=self.exchange,
            quantity=self.quantity,
            side=self.side,
            order_type=self.order_type,
            product=self.product,
            variety=self.variety,
            price=self.price,
            trigger_price=self.trigger_price,
        )


class BrokerOrderModifyRequest(BaseModel):
    """Schema for modifying an existing broker order."""
    symbol: str = Field(..., min_length=1, description="Trading symbol e.g., INFY")
    exchange: str = Field(..., min_length=1, description="Exchange code e.g., NSE")
    quantity: Decimal = Field(..., gt=0, description="Order quantity")
    side: str = Field(..., min_length=1, description="Transaction side: BUY or SELL")
    order_type: str = Field(..., min_length=1, description="Order type e.g., LIMIT, MARKET")
    product: str = Field(..., min_length=1, description="Product code e.g., CNC, MIS")
    variety: str = Field("regular", min_length=1, description="Order variety e.g., regular")
    price: Optional[Decimal] = Field(None, ge=0, description="Limit price")
    trigger_price: Optional[Decimal] = Field(None, ge=0, description="Trigger price")

    def to_domain_request(self) -> BrokerOrderRequest:
        """Convert API schema to domain BrokerOrderRequest."""
        return BrokerOrderRequest(
            symbol=self.symbol,
            exchange=self.exchange,
            quantity=self.quantity,
            side=self.side,
            order_type=self.order_type,
            product=self.product,
            variety=self.variety,
            price=self.price,
            trigger_price=self.trigger_price,
        )


class BrokerOrderCancelRequest(BaseModel):
    """Schema for cancelling a broker order."""
    variety: str = Field("regular", min_length=1, description="Order variety e.g., regular")
    parent_order_id: Optional[str] = Field(None, description="Parent order ID if applicable")

    def to_domain_request(self, order_id: str) -> BrokerCancelOrderRequest:
        """Convert API schema to domain BrokerCancelOrderRequest."""
        return BrokerCancelOrderRequest(
            order_id=order_id,
            variety=self.variety,
            parent_order_id=self.parent_order_id,
        )


class BrokerOrderResponse(BaseModel):
    """Schema for returning broker order details."""
    model_config = ConfigDict(from_attributes=True)

    order_id: str
    symbol: str
    side: str
    quantity: Decimal
    status: str

    @classmethod
    def from_domain(cls, domain_order: BrokerOrder) -> "BrokerOrderResponse":
        """Construct response from domain BrokerOrder DTO."""
        return cls(
            order_id=domain_order.order_id,
            symbol=domain_order.symbol,
            side=domain_order.side,
            quantity=domain_order.quantity,
            status=domain_order.status,
        )


class BrokerOrderActionResultResponse(BaseModel):
    """Schema for returning broker order action result."""
    model_config = ConfigDict(from_attributes=True)

    order_id: str
    success: bool

    @classmethod
    def from_domain(cls, domain_result: BrokerOrderActionResult) -> "BrokerOrderActionResultResponse":
        """Construct response from domain BrokerOrderActionResult DTO."""
        return cls(
            order_id=domain_result.order_id,
            success=domain_result.success,
        )


class BrokerOrderLedgerResponse(BaseModel):
    """Persisted application-owned broker order lifecycle state."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    broker_order_id: str
    symbol: str
    exchange: Optional[str] = None
    side: str
    quantity: Decimal
    filled_quantity: Decimal
    average_fill_price: Optional[Decimal] = None
    order_type: Optional[str] = None
    product: Optional[str] = None
    variety: Optional[str] = None
    price: Optional[Decimal] = None
    trigger_price: Optional[Decimal] = None
    status: str
    strategy_instance_id: Optional[str] = None
    signal_id: Optional[str] = None
    last_broker_sync_at: datetime
    broker_created_at: Optional[datetime] = None
    broker_updated_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_record(cls, record) -> "BrokerOrderLedgerResponse":
        return cls(
            id=str(record.id),
            broker_order_id=record.broker_order_id,
            symbol=record.symbol, exchange=record.exchange, side=record.side,
            quantity=record.quantity, filled_quantity=record.filled_quantity,
            average_fill_price=record.average_fill_price, order_type=record.order_type,
            product=record.product, variety=record.variety, price=record.price,
            trigger_price=record.trigger_price, status=record.status,
            strategy_instance_id=str(record.strategy_instance_id) if record.strategy_instance_id else None,
            signal_id=str(record.signal_id) if record.signal_id else None,
            last_broker_sync_at=record.last_broker_sync_at, broker_created_at=record.broker_created_at,
            broker_updated_at=record.broker_updated_at, created_at=record.created_at, updated_at=record.updated_at,
        )

class TradingExecutionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    execution_mode: str
    external_execution_id: str
    broker_order_record_id: Optional[str] = None
    strategy_instance_id: Optional[str] = None
    signal_id: Optional[str] = None
    symbol: str
    side: str
    quantity: Decimal
    price: Decimal
    executed_at: datetime

    @classmethod
    def from_record(cls, record) -> "TradingExecutionResponse":
        return cls(
            id=str(record.id), execution_mode=record.execution_mode,
            external_execution_id=record.external_execution_id,
            broker_order_record_id=str(record.broker_order_record_id) if record.broker_order_record_id else None,
            strategy_instance_id=str(record.strategy_instance_id) if record.strategy_instance_id else None,
            signal_id=str(record.signal_id) if record.signal_id else None,
            symbol=record.symbol, side=record.side, quantity=record.quantity,
            price=record.price, executed_at=record.executed_at,
        )


class TradingPositionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    symbol: str
    quantity: Decimal
    average_price: Decimal
    realized_pnl: Decimal
    last_price: Optional[Decimal] = None
    market_value: Decimal = Decimal("0")
    unrealized_pnl: Decimal = Decimal("0")
    valuation_at: Optional[datetime] = None
    strategy_instance_id: Optional[str] = None
    last_execution_at: Optional[datetime] = None
    updated_at: datetime

    @classmethod
    def from_record(cls, record) -> "TradingPositionResponse":
        return cls(
            id=str(record.id), symbol=record.symbol, quantity=record.quantity,
            average_price=record.average_price, realized_pnl=record.realized_pnl,
            last_price=record.last_price, market_value=record.market_value,
            unrealized_pnl=record.unrealized_pnl, valuation_at=record.valuation_at,
            strategy_instance_id=str(record.strategy_instance_id) if record.strategy_instance_id else None,
            last_execution_at=record.last_execution_at, updated_at=record.updated_at,
        )
