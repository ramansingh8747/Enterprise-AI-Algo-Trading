from typing import Literal
from pydantic import BaseModel, Field
from app.schemas.live_activation import LiveActivationResponse
from app.schemas.live_readiness import LiveReadinessResponse
from app.schemas.pre_live_operational import PreLiveOperationalResponse

LiveGateVerdict = Literal[
    "READY_FOR_CONTROLLED_LIVE_ACTIVATION",
    "CONDITIONAL",
    "NOT_READY",
]


class AdminLiveGateResponse(BaseModel):
    broker_id: str
    verified_at: str
    overall_verdict: LiveGateVerdict
    live_trading_enabled: bool
    strategy_scheduler_enabled: bool
    kill_switch_active: bool
    execution_state: Literal["DISABLED", "BLOCKED", "READY"]
    readiness: LiveReadinessResponse
    operational: PreLiveOperationalResponse
    activation: LiveActivationResponse | None = None
    safety_message: str = Field(
        default="LIVE execution remains server-side disabled until explicitly enabled in the controlled production environment."
    )
