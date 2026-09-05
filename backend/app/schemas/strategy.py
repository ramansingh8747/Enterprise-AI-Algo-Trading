"""
Pydantic request/response schemas for the Strategy CRUD REST API.

Covers:
  - StrategyDefinition (create, update, response)
  - StrategyInstance (create, response)
  - StrategySignal (response / history)

Financial precision note:
  quantity and price in StrategySignalResponse are Decimal-typed and
  serialize as fixed-precision strings via Pydantic's JSON serialization.

Security note:
  No api_key, api_secret, access_token, password, or credential fields
  are ever included in any schema.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Strategy Definition schemas
# ---------------------------------------------------------------------------


class StrategyDefinitionCreateRequest(BaseModel):
    """Request payload to create a new strategy definition."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Human-readable name for the strategy definition.",
    )
    strategy_type: str = Field(
        default="DETERMINISTIC_MOMENTUM",
        max_length=64,
        description="Strategy type identifier (e.g. DETERMINISTIC_MOMENTUM).",
    )
    config_json: Optional[str] = Field(
        default=None,
        description="Optional JSON-encoded strategy configuration parameters.",
    )


class StrategyDefinitionUpdateRequest(BaseModel):
    """Request payload to update an existing strategy definition.

    All fields are optional — only provided fields are updated.
    """

    name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=255,
        description="Updated strategy name.",
    )
    strategy_type: Optional[str] = Field(
        default=None,
        max_length=64,
        description="Updated strategy type.",
    )
    config_json: Optional[str] = Field(
        default=None,
        description="Updated JSON configuration. Pass null to clear.",
    )
    is_active: Optional[bool] = Field(
        default=None,
        description="Set to false to soft-disable the definition.",
    )


class BulkStrategyConfigUpdateRequest(BaseModel):
    """Payload to bulk update budget & risk configuration across all strategies."""

    morning_scalper_budget_inr: Optional[float] = Field(default=None, ge=100.0, le=500000.0)
    hero_zero_budget_inr: Optional[float] = Field(default=None, ge=100.0, le=50000.0)
    full_day_equity_budget_inr: Optional[float] = Field(default=None, ge=500.0, le=5000000.0)
    risk_per_trade_inr: Optional[float] = Field(default=None, ge=50.0, le=50000.0)
    position_sizing_mode: Optional[str] = None
    capital: Optional[float] = None
    auto_pilot: Optional[bool] = None
    min_holding_seconds: Optional[int] = None
    confirm_volume_spike: Optional[bool] = None
    enforce_market_sentiment: Optional[bool] = None



class StrategyDefinitionResponse(BaseModel):
    """API response model for a StrategyDefinition record."""

    id: UUID
    user_id: UUID
    name: str
    strategy_type: str
    config_json: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Strategy Instance schemas
# ---------------------------------------------------------------------------


class StrategyInstanceCreateRequest(BaseModel):
    """Request payload to create a new strategy instance.

    execution_mode defaults to PAPER for safety.
    LIVE mode requires an active broker session validated server-side.
    """

    broker_id: UUID = Field(
        ...,
        description="UUID of the broker account to use for this strategy instance.",
    )
    execution_mode: str = Field(
        default="PAPER",
        description="Execution mode: PAPER (default) or LIVE.",
    )


class StrategyInstanceResponse(BaseModel):
    """API response model for a StrategyInstance record."""

    id: UUID
    strategy_definition_id: UUID
    user_id: UUID
    broker_id: UUID
    execution_mode: str
    status: str
    started_at: Optional[datetime] = None
    stopped_at: Optional[datetime] = None
    last_execution_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Strategy Signal schemas
# ---------------------------------------------------------------------------


class StrategySignalResponse(BaseModel):
    """API response model for a StrategySignal.

    quantity and price are Decimal-typed and serialize as fixed-precision
    strings to preserve financial accuracy across JSON transport.
    """

    id: UUID
    strategy_instance_id: UUID
    symbol: str
    side: str
    quantity: Decimal = Field(description="Signal quantity.")
    suggested_quantity: Optional[Decimal] = Field(default=None, description="Suggested strategy quantity.")
    actual_quantity: Optional[Decimal] = Field(default=None, description="Actual user approved quantity.")
    order_type: str
    price: Optional[Decimal] = Field(
        default=None,
        description="Entry price if applicable (Decimal precision).",
    )
    stop_loss: Optional[Decimal] = Field(default=None, description="Calculated stop loss price.")
    target: Optional[Decimal] = Field(default=None, description="Calculated take profit target price.")
    risk_reward: Optional[str] = Field(default=None, description="Risk to reward ratio.")
    reason: Optional[str] = Field(default=None, description="Strategy rationale.")
    indicators_json: Optional[str] = Field(default=None, description="Technical indicator snapshot.")
    executed_order_id: Optional[str] = Field(default=None, description="Associated executed order ID.")
    actioned_at: Optional[datetime] = Field(default=None, description="Timestamp when signal was actioned.")
    signal_fingerprint: str
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SignalApprovalRequest(BaseModel):
    """Request payload for manual user approval of a proposed signal."""

    actual_quantity: Decimal = Field(..., gt=0, description="Actual quantity confirmed by user.")
    execution_mode: Optional[str] = Field(default="PAPER", description="Execution mode: PAPER or LIVE.")
    custom_stop_loss: Optional[Decimal] = Field(default=None, description="Optional overridden Stop Loss.")
    custom_target: Optional[Decimal] = Field(default=None, description="Optional overridden Target.")


class SignalApprovalResponse(BaseModel):
    """Response returned upon user approval and placement of manual order."""

    signal_id: str
    status: str
    order_id: str
    actual_quantity: str
    side: str
    symbol: str
    execution_mode: str


class SignalIgnoreResponse(BaseModel):
    """Response returned upon user dismissing/ignoring a signal."""

    signal_id: str
    status: str
    symbol: str
    side: str
