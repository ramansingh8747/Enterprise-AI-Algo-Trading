from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.broker_order import TradingExecutionResponse


class PaperOrderCreateRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=100)
    side: str = Field(..., pattern=r"^(?i)(BUY|SELL)$")
    quantity: Decimal = Field(..., gt=0)
    order_type: str = Field("MARKET", pattern=r"^(?i)(MARKET|LIMIT)$")
    price: Decimal = Field(..., gt=0)
    broker_id: Optional[UUID] = None
    strategy_instance_id: Optional[UUID] = None
    signal_id: Optional[UUID] = None
    order_source: Optional[str] = Field("MANUAL_BUY", pattern=r"^(?i)(MANUAL_BUY|MANUAL_SELL|AUTO_STOP_LOSS)$")
    stop_loss: Optional[Decimal] = None
    target: Optional[Decimal] = None


class PaperOrderResponse(BaseModel):
    id: str
    order_id: str
    execution_mode: str
    symbol: str
    side: str
    quantity: Decimal
    price: Decimal
    status: str = "FILLED"
    order_source: Optional[str] = "MANUAL_BUY"
    stop_loss: Optional[Decimal] = None
    target: Optional[Decimal] = None
    executed_at: datetime
    broker_id: Optional[UUID] = None
    strategy_instance_id: Optional[UUID] = None
    signal_id: Optional[UUID] = None
    paper_portfolio_id: Optional[UUID] = None

    @classmethod
    def from_execution(
        cls,
        execution,
        paper_portfolio_id: Optional[UUID] = None,
        stop_loss: Optional[Decimal] = None,
        target: Optional[Decimal] = None,
    ) -> "PaperOrderResponse":
        return cls(
            id=str(execution.id),
            order_id=execution.external_execution_id,
            execution_mode=execution.execution_mode,
            symbol=execution.symbol,
            side=execution.side,
            quantity=execution.quantity,
            price=execution.price,
            status="FILLED",
            order_source=getattr(execution, "order_source", "MANUAL_BUY") or "MANUAL_BUY",
            stop_loss=stop_loss,
            target=target,
            executed_at=execution.executed_at,
            broker_id=execution.broker_id,
            strategy_instance_id=execution.strategy_instance_id,
            signal_id=execution.signal_id,
            paper_portfolio_id=paper_portfolio_id,
        )

