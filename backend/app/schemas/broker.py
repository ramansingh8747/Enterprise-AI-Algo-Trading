from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict


class BrokerBase(BaseModel):
    """Base schema for Broker."""
    broker_name: str = Field(..., min_length=1, max_length=255)
    broker_type: str = Field(..., min_length=1, max_length=50)
    client_id: str | None = Field(None, max_length=255)
    is_active: bool = True

class BrokerCreate(BrokerBase):
    """Schema for creating a new broker."""
    api_key: str = Field(..., min_length=1, max_length=255)
    api_secret: str = Field(..., min_length=1, max_length=255)

class BrokerUpdate(BaseModel):
    """Schema for updating an existing broker."""
    broker_name: str | None = Field(None, min_length=1, max_length=255)
    broker_type: str | None = Field(None, min_length=1, max_length=50)
    api_key: str | None = Field(None, min_length=1, max_length=255)
    api_secret: str | None = Field(None, min_length=1, max_length=255)
    client_id: str | None = Field(None, max_length=255)
    is_active: bool | None = None

class BrokerResponse(BrokerBase):
    """Schema for returning broker data — credentials are intentionally excluded."""
    model_config = ConfigDict(from_attributes=True)
    id: UUID

