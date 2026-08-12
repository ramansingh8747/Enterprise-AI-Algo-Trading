from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime
from uuid import UUID

class AlertCreate(BaseModel):
    type: str = Field("SYSTEM", description="Alert category: SYSTEM, RISK, BROKER, ORDER, STRATEGY")
    severity: str = Field("INFO", description="Alert severity: INFO, SUCCESS, WARNING, DANGER")
    title: str = Field(..., min_length=1, max_length=150)
    message: str = Field(..., min_length=1)
    route: Optional[str] = Field(None, description="Optional frontend navigation route")

class AlertUpdate(BaseModel):
    read: Optional[bool] = None
    title: Optional[str] = None
    message: Optional[str] = None

class AlertResponse(BaseModel):
    id: UUID
    user_id: UUID
    type: str
    severity: str
    title: str
    message: str
    read: bool
    route: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
