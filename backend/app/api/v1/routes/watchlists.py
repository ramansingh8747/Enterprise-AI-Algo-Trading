from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.dependencies.database import get_db
from app.dependencies.auth import get_current_active_user

from app.database.models.user import User
from app.schemas.watchlist import (
    WatchlistCreate,
    WatchlistResponse,
    WatchlistItemCreate,
    WatchlistItemResponse,
)
from app.database.repositories.watchlist_repository import WatchlistRepository

router = APIRouter(prefix="/watchlists", tags=["watchlists"])

@router.get("", response_model=List[WatchlistResponse])
def list_watchlists(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """List all watchlists owned by current authenticated user."""
    repo = WatchlistRepository(db)
    return repo.list_user_watchlists(current_user.id)

@router.post("", response_model=WatchlistResponse, status_code=status.HTTP_201_CREATED)
def create_watchlist(
    data: WatchlistCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Create a new custom watchlist for current user."""
    repo = WatchlistRepository(db)
    return repo.create_watchlist(current_user.id, name=data.name, is_default=data.is_default)

@router.get("/{watchlist_id}", response_model=WatchlistResponse)
def get_watchlist(
    watchlist_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get single watchlist by ID ensuring user ownership."""
    repo = WatchlistRepository(db)
    wl = repo.get_watchlist(watchlist_id, current_user.id)
    if not wl:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watchlist not found or access denied",
        )
    return wl

@router.post("/{watchlist_id}/items", response_model=WatchlistItemResponse, status_code=status.HTTP_201_CREATED)
def add_watchlist_item(
    watchlist_id: UUID,
    data: WatchlistItemCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Add symbol item to watchlist."""
    repo = WatchlistRepository(db)
    try:
        item = repo.add_item_to_watchlist(watchlist_id, current_user.id, data.symbol)
        return item
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watchlist not found or access denied",
        )
    except ValueError as ve:
        err_msg = str(ve)
        if "already exists" in err_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=err_msg,
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_msg,
        )

@router.delete("/{watchlist_id}/items/{symbol}", status_code=status.HTTP_204_NO_CONTENT)
def remove_watchlist_item(
    watchlist_id: UUID,
    symbol: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Remove symbol item from watchlist."""
    repo = WatchlistRepository(db)
    try:
        success = repo.remove_item_from_watchlist(watchlist_id, current_user.id, symbol)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Symbol '{symbol}' not found in watchlist",
            )
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watchlist not found or access denied",
        )

@router.delete("/{watchlist_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_watchlist(
    watchlist_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Delete custom watchlist owned by user."""
    repo = WatchlistRepository(db)
    try:
        repo.delete_watchlist(watchlist_id, current_user.id)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watchlist not found or access denied",
        )
