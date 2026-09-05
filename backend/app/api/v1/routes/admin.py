from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.dependencies.auth import RoleChecker
from app.dependencies.database import get_db
from app.database.models.user import User, UserRole
from app.schemas.user import UserPaginatedResponse, AdminUserUpdate
from app.schemas.auth import UserResponse
from app.schemas.admin_reconciliation import ReconciliationSummary
from app.services.admin_reconciliation_service import AdminReconciliationService
from app.dependencies.event_bus import get_trading_event_publisher
from app.services.event_bus.trading_events import TradingEventPublisher

router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    dependencies=[Depends(RoleChecker([UserRole.ADMIN]))],
)

@router.get("/users", response_model=UserPaginatedResponse)
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None, min_length=1, max_length=100),
    role: Optional[UserRole] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    """List users with server-side pagination and safe admin filters."""
    query = db.query(User)
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(or_(
            User.full_name.ilike(term),
            User.username.ilike(term),
            User.email.ilike(term),
        ))
    if role is not None:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    total = query.count()
    users = (
        query
        .order_by(User.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return {
        "total": total,
        "items": [UserResponse.model_validate(user) for user in users]
    }


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: str,
    db: Session = Depends(get_db),
):
    """Get specific user details by ID."""
    from uuid import UUID
    from fastapi import HTTPException, status
    try:
        uid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID format.")

    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return UserResponse.model_validate(user)


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    data: AdminUserUpdate,
    db: Session = Depends(get_db),
):
    """Update user profile, role, status, or verification state (Admin only)."""
    from uuid import UUID
    from fastapi import HTTPException, status
    try:
        uid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID format.")

    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if data.full_name is not None:
        user.full_name = data.full_name
    if data.email is not None:
        existing = db.query(User).filter(User.email == data.email, User.id != uid).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is already in use by another user.")
        user.email = data.email
    if data.role is not None:
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.is_verified is not None:
        user.is_verified = data.is_verified

    db.commit()
    db.refresh(user)
    return UserResponse.model_validate(user)


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
):
    """Delete a user record (Admin only)."""
    from uuid import UUID
    from fastapi import HTTPException, status
    try:
        uid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID format.")

    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    db.delete(user)
    db.commit()
    return None



@router.get("/reconciliation", response_model=ReconciliationSummary)
def reconcile_brokers(
    db: Session = Depends(get_db),
    trading_events: TradingEventPublisher = Depends(get_trading_event_publisher),
):
    """Run a read-only on-demand reconciliation of active broker sessions."""
    return AdminReconciliationService(db, trading_events).reconcile()
