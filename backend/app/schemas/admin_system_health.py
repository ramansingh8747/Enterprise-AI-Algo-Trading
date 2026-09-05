from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

HealthStatus = Literal["UP", "DOWN", "DISABLED", "UNKNOWN"]


class SystemHealthComponent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    status: HealthStatus
    message: str
    checked_at: datetime


class BrokerHealthComponent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    broker_id: UUID
    broker_name: str
    broker_type: str
    status: HealthStatus
    message: str
    checked_at: datetime


class AdminSystemHealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    checked_at: datetime
    overall_status: Literal["UP", "DEGRADED", "DOWN"]
    live_trading_enabled: bool
    strategy_scheduler_enabled: bool
    components: list[SystemHealthComponent] = Field(default_factory=list)
    brokers: list[BrokerHealthComponent] = Field(default_factory=list)
