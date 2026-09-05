from enum import Enum
from typing import Any, Dict, Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal

class EventType(str, Enum):
    STRATEGY_CREATED = "strategy.created"
    STRATEGY_UPDATED = "strategy.updated"
    STRATEGY_DELETED = "strategy.deleted"
    INSTANCE_STARTED = "instance.started"
    INSTANCE_PAUSED = "instance.paused"
    INSTANCE_RESUMED = "instance.resumed"
    INSTANCE_STOPPED = "instance.stopped"
    INSTANCE_FAILED = "instance.failed"
    SIGNAL_GENERATED = "signal.generated"
    SIGNAL_REJECTED = "signal.rejected"
    SIGNAL_EXECUTED = "signal.executed"
    QUOTE_UPDATED = "quote.updated"
    QUOTE_STALE = "quote.stale"
    ORDER_CREATED = "order.created"
    ORDER_UPDATED = "order.updated"
    ORDER_CANCELLED = "order.cancelled"
    ORDER_REJECTED = "order.rejected"
    EXECUTION_CREATED = "execution.created"
    POSITION_UPDATED = "position.updated"
    PORTFOLIO_VALUATION_UPDATED = "portfolio.valuation.updated"
    RECONCILIATION_COMPLETED = "reconciliation.completed"
    AUDIT_EVENT = "audit.event"
    RISK_SETTINGS_UPDATED = "risk.settings.updated"

class Event(BaseModel):
    event_id: UUID
    event_type: EventType
    timestamp: datetime
    user_id: Optional[UUID] = None
    broker_id: Optional[UUID] = None
    strategy_id: Optional[UUID] = None
    strategy_instance_id: Optional[UUID] = None
    symbol: Optional[str] = None
    execution_mode: Optional[str] = None
    sequence_number: Optional[int] = None
    payload: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(
        json_encoders={Decimal: lambda v: str(v)}
    )
