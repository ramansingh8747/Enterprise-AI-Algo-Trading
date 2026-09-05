from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class ReconciliationMetric(BaseModel):
    status: Literal["MATCHED", "MISMATCH", "UNAVAILABLE", "ERROR"]
    internal_count: int = 0
    external_count: int = 0
    difference_count: int = 0
    details: list[dict] = Field(default_factory=list)


class ReconciliationAccount(BaseModel):
    user_id: UUID
    broker_id: UUID
    broker_name: str
    broker_type: str
    session_status: Literal["ACTIVE", "EXPIRED", "MISSING"]
    overall_status: Literal["MATCHED", "MISMATCH", "UNAVAILABLE", "ERROR"]
    checked_at: datetime
    cash: ReconciliationMetric
    positions: ReconciliationMetric
    orders: ReconciliationMetric
    error: Optional[str] = None


class ReconciliationSummary(BaseModel):
    checked_at: datetime
    overall_status: Literal["MATCHED", "MISMATCH", "UNAVAILABLE", "ERROR"]
    accounts_checked: int
    matched_accounts: int
    mismatched_accounts: int
    unavailable_accounts: int
    error_accounts: int
    cash: ReconciliationMetric
    positions: ReconciliationMetric
    orders: ReconciliationMetric
    accounts: list[ReconciliationAccount]
    model_config = ConfigDict(from_attributes=True)
