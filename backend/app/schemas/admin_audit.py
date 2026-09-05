from datetime import datetime
from typing import Any, Optional
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict


class AuditEventItem(BaseModel):
    id: UUID
    action: str
    outcome: str
    user_id: Optional[UUID] = None
    broker_id: Optional[UUID] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    details: dict[str, Any] = Field(default_factory=dict)
    occurred_at: datetime
    user_name: Optional[str] = None
    username: Optional[str] = None
    broker_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AuditEventPage(BaseModel):
    total: int
    items: list[AuditEventItem]
    page: int
    page_size: int


class AuditSummary(BaseModel):
    total: int
    successes: int
    blocked: int
    failures: int
    info: int
    last_event_at: Optional[datetime] = None
