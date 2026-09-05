from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field


class AdminRiskSettingsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    max_order_quantity: Decimal
    max_order_notional: Decimal
    max_position_quantity: Decimal
    max_exposure_notional: Decimal
    max_orders_per_minute: int
    daily_loss_limit: Decimal
    max_drawdown_percent: Decimal
    kill_switch_active: bool
    updated_at: datetime


class AdminRiskSettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    max_order_quantity: Decimal = Field(gt=0)
    max_order_notional: Decimal = Field(gt=0)
    max_position_quantity: Decimal = Field(gt=0)
    max_exposure_notional: Decimal = Field(gt=0)
    max_orders_per_minute: int = Field(gt=0, le=10000)
    daily_loss_limit: Decimal = Field(gt=0)
    max_drawdown_percent: Decimal = Field(gt=0, le=100)
