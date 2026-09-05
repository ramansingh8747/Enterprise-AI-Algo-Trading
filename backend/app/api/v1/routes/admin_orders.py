from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.models.user import UserRole
from app.dependencies.auth import RoleChecker
from app.dependencies.database import get_db
from app.schemas.admin_orders import AdminOrderListResponse, AdminOrderItem
from app.services.admin_order_service import AdminOrderService

router = APIRouter(
    prefix="/admin/orders",
    tags=["Admin Orders"],
    dependencies=[Depends(RoleChecker([UserRole.ADMIN]))],
)


@router.get("", response_model=AdminOrderListResponse)
def list_admin_orders(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = Query(None, max_length=100),
    execution_mode: Optional[str] = Query(None, pattern=r"^(?i)(PAPER|LIVE)$"),
    order_status: Optional[str] = Query(None, alias="status", max_length=30),
    side: Optional[str] = Query(None, pattern=r"^(?i)(BUY|SELL)$"),
) -> AdminOrderListResponse:
    return AdminOrderService(db).list_orders(
        page=page,
        page_size=page_size,
        search=search,
        execution_mode=execution_mode,
        status=order_status,
        side=side,
    )


@router.get("/{order_ref}", response_model=AdminOrderItem)
def get_admin_order(
    order_ref: UUID,
    db: Session = Depends(get_db),
) -> AdminOrderItem:
    order = AdminOrderService(db).get_order(order_ref)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")
    return order
