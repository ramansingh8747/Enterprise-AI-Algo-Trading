from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class AdminBrokerSessionSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    active: bool
    session_count: int
    active_session_count: int
    earliest_expiry: datetime | None = None


class AdminBrokerItem(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: UUID
    broker_name: str
    broker_type: str
    client_id: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    session: AdminBrokerSessionSummary


class AdminBrokerListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[AdminBrokerItem]
    total: int
