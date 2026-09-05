from typing import Literal
from pydantic import BaseModel, Field


ReadinessStatus = Literal["PASS", "FAIL", "WARN"]
ReadinessVerdict = Literal["LIVE_READY", "CONDITIONAL", "NOT_READY"]


class ReadinessCheck(BaseModel):
    name: str
    status: ReadinessStatus
    message: str
    details: dict = Field(default_factory=dict)


class LiveReadinessResponse(BaseModel):
    verdict: ReadinessVerdict
    broker_id: str
    verified_at: str
    order_execution_attempted: bool = False
    checks: list[ReadinessCheck]
