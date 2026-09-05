from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class StrategyImportResponse(BaseModel):
    id: UUID
    user_id: UUID
    original_filename: str
    file_type: str
    file_size: int
    extracted_text: Optional[str] = None
    extracted_config: dict[str, Any] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)
    status: str
    strategy_definition_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StrategyImportConfirmRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    strategy_type: str = Field(default="CUSTOM_IMPORTED", max_length=64)


class StrategyImportConfirmResponse(BaseModel):
    import_id: UUID
    strategy_definition_id: UUID
    strategy_name: str
    status: str
