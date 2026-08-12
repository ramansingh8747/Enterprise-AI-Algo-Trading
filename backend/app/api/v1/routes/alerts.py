from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.dependencies.database import get_db
from app.dependencies.auth import get_current_active_user
from app.database.models.user import User
from app.schemas.alert import AlertCreate, AlertResponse
from app.database.repositories.alert_repository import AlertRepository

router = APIRouter(prefix="/alerts", tags=["alerts"])

@router.get("", response_model=List[AlertResponse])
def list_alerts(
    unread_only: bool = False,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """List all alerts owned by current user."""
    repo = AlertRepository(db)
    return repo.list_user_alerts(current_user.id, unread_only=unread_only)


@router.post("", response_model=AlertResponse, status_code=status.HTTP_201_CREATED)
def create_alert(
    data: AlertCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Create a new system/risk alert for current user."""
    repo = AlertRepository(db)
    return repo.create_alert(
        user_id=current_user.id,
        title=data.title,
        message=data.message,
        type=data.type,
        severity=data.severity,
        route=data.route,
    )

@router.patch("/{alert_id}/read", response_model=AlertResponse)
def mark_alert_read(
    alert_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Mark specific alert as read."""
    repo = AlertRepository(db)
    alt = repo.mark_as_read(alert_id, current_user.id)
    if not alt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found or access denied",
        )
    return alt

@router.post("/mark-all-read", status_code=status.HTTP_200_OK)
def mark_all_alerts_read(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Mark all user alerts as read."""
    repo = AlertRepository(db)
    count = repo.mark_all_as_read(current_user.id)
    return {"success": True, "marked_count": count}

@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_alert(
    alert_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Delete specific alert."""
    repo = AlertRepository(db)
    success = repo.delete_alert(alert_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found or access denied",
        )

@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def clear_all_alerts(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Clear all alerts for current user."""
    repo = AlertRepository(db)
    repo.clear_all_alerts(current_user.id)
