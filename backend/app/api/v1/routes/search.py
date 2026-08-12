from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_active_user
from app.dependencies.database import get_db
from app.database.models.user import User
from app.schemas.search import GlobalSearchResponse
from app.database.repositories.search_repository import SearchRepository

router = APIRouter(tags=["Search"])


@router.get("", response_model=GlobalSearchResponse, status_code=status.HTTP_200_OK)
def search_workspace(
    q: str = Query(..., min_length=1, description="Search query string"),
    category: Optional[str] = Query(None, description="Optional category filter (EQUITY, STRATEGY, JOURNAL, ALERT, ORDER, NAVIGATION, ACTION)"),
    limit: int = Query(20, ge=1, le=50, description="Max results limit"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Unified global workspace search across market equities, user strategies,
    trading journal entries, system alerts, portfolios, and navigation actions.
    Enforces strict user isolation.
    """
    repo = SearchRepository(db)
    items = repo.search_all(user_id=current_user.id, query=q, category=category, limit=limit)
    return GlobalSearchResponse(
        query=q,
        total_results=len(items),
        results=items
    )
