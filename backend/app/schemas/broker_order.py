from typing import Optional
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
