from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional
from datetime import datetime
from uuid import UUID

class WatchlistItemCreate(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=50, description="Equity or index symbol (e.g. RELIANCE, NIFTY 50)")

class WatchlistItemResponse(BaseModel):
    id: UUID
    watchlist_id: UUID
    symbol: str
    order_index: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class WatchlistCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Watchlist workspace name")
    is_default: bool = Field(False, description="Set as default user watchlist")

class WatchlistUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    is_default: Optional[bool] = None

class WatchlistResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    is_default: bool
    items: List[WatchlistItemResponse] = []
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
