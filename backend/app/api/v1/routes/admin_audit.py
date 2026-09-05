from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import RoleChecker
from app.database.models.user import UserRole
from app.schemas.admin_audit import AuditEventItem, AuditEventPage, AuditSummary
from app.services.admin_audit_service import AdminAuditService

router = APIRouter(
    prefix="/admin/audit",
    tags=["Admin Audit"],
    dependencies=[Depends(RoleChecker([UserRole.ADMIN]))],
)

service = AdminAuditService()


def _item(row) -> AuditEventItem:
    event, full_name, username, broker_name = row
    return AuditEventItem(
        id=event.id,
        action=event.action,
        outcome=event.outcome,
        user_id=event.user_id,
        broker_id=event.broker_id,
        resource_type=event.resource_type,
        resource_id=event.resource_id,
        details=event.details or {},
        occurred_at=event.occurred_at,
        user_name=full_name,
        username=username,
        broker_name=broker_name,
    )


@router.get("", response_model=AuditEventPage)
def list_audit_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    action: Optional[str] = None,
    outcome: Optional[str] = None,
    user_id: Optional[UUID] = None,
    broker_id: Optional[UUID] = None,
    search: Optional[str] = None,
    since_hours: Optional[int] = Query(None, ge=1, le=24 * 30),
    db: Session = Depends(get_db),
):
    total, rows = service.list_events(db, page=page, page_size=page_size, action=action, outcome=outcome, user_id=user_id, broker_id=broker_id, search=search, since_hours=since_hours)
    return AuditEventPage(total=total, items=[_item(row) for row in rows], page=page, page_size=page_size)


@router.get("/summary", response_model=AuditSummary)
def audit_summary(
    since_hours: int = Query(24, ge=1, le=24 * 30),
    db: Session = Depends(get_db),
):
    return service.summary(db, since_hours=since_hours)


@router.get("/{event_id}", response_model=AuditEventItem)
def audit_event_detail(event_id: UUID, db: Session = Depends(get_db)):
    row = service.get_event(db, event_id)
    if not row:
        raise HTTPException(status_code=404, detail="Audit event not found")
    return _item(row)
