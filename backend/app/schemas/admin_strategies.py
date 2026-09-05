from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class AdminStrategyItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    user_id: UUID
    user_name: str
    username: str
    name: str
    strategy_type: str
    config_json: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    imported_file_name: str | None = None
    imported_file_type: str | None = None
    imported_file_id: UUID | None = None


class AdminStrategyListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[AdminStrategyItem]
    total: int
