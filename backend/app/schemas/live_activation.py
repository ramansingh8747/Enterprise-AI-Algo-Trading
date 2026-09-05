from typing import Literal
from pydantic import BaseModel, Field

ActivationVerdict = Literal["ACTIVATION_AUTHORIZED", "ACTIVATION_BLOCKED"]


class LiveActivationResponse(BaseModel):
    verdict: ActivationVerdict
    broker_id: str
    verified_at: str
    confirmation_required: bool = True
    order_execution_attempted: bool = False
    live_trading_enabled: bool
    instructions: list[str] = Field(default_factory=list)
    blocking_reasons: list[str] = Field(default_factory=list)
