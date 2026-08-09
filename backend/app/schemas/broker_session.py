from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class BrokerSessionCreate(BaseModel):
    broker_id: UUID
    access_token: str
    expires_at: datetime

    model_config = ConfigDict(from_attributes=True)

class BrokerSessionResponse(BaseModel):
    id: UUID
    broker_id: UUID
    user_id: UUID
    expires_at: datetime

    model_config = ConfigDict(from_attributes=True)
