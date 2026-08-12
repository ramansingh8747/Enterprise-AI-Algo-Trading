from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict


class SearchResultItem(BaseModel):
    id: str
    category: str  # EQUITY, STRATEGY, ORDER, JOURNAL, ALERT, NAVIGATION, ACTION
    title: str
    subtitle: Optional[str] = None
    description: Optional[str] = None
    symbol: Optional[str] = None
    route: Optional[str] = None
    action: Optional[str] = "NAVIGATE"  # NAVIGATE, OPEN_ORDER
    metadata: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


class GlobalSearchResponse(BaseModel):
    query: str
    total_results: int
    results: List[SearchResultItem]

    model_config = ConfigDict(from_attributes=True)
