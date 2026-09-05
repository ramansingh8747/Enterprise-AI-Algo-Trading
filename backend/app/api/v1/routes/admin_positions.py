from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.dependencies.auth import RoleChecker
from app.dependencies.database import get_db
from app.database.models.user import UserRole
from app.schemas.admin_positions import AdminPositionListResponse, AdminPositionItem
from app.services.admin_position_service import AdminPositionService

router = APIRouter(
    prefix="/admin/positions",
    tags=["Admin Positions"],
    dependencies=[Depends(RoleChecker([UserRole.ADMIN]))],
)


@router.get("", response_model=AdminPositionListResponse)
def list_admin_positions(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = Query(None, max_length=100),
    execution_mode: Optional[str] = Query(None, pattern="^(PAPER|LIVE)$"),
    user_id: Optional[UUID] = None,
    broker_id: Optional[UUID] = None,
    strategy_instance_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
) -> AdminPositionListResponse:
    return AdminPositionService(db).list_positions(
        page=page, page_size=page_size, search=search,
        execution_mode=execution_mode, user_id=user_id,
        broker_id=broker_id, strategy_instance_id=strategy_instance_id,
    )


@router.get("/{position_ref}", response_model=AdminPositionItem)
def get_admin_position(
    position_ref: UUID,
    source: str = Query(..., pattern="^(PAPER_POSITION|LIVE_POSITION)$"),
    db: Session = Depends(get_db),
) -> AdminPositionItem:
    item = AdminPositionService(db).get_position(position_ref, source)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Position not found")
    return item
