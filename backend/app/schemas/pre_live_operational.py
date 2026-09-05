from typing import Literal
from pydantic import BaseModel, Field

OperationalStatus = Literal["PASS", "FAIL", "WARN"]
OperationalVerdict = Literal["READY_FOR_CONTROLLED_LIVE_ACTIVATION", "CONDITIONAL", "NOT_READY"]


class OperationalCheck(BaseModel):
    name: str
    status: OperationalStatus
    message: str
    mode: Literal["LIVE_READINESS", "SIMULATED_DRILL", "STATIC"]
    details: dict = Field(default_factory=dict)


class PreLiveOperationalResponse(BaseModel):
    verdict: OperationalVerdict
    broker_id: str
    verified_at: str
    order_execution_attempted: bool = False
    real_broker_order_attempted: bool = False
    checks: list[OperationalCheck]
