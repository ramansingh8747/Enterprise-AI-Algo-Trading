from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.models.user import UserRole
from app.dependencies.auth import RoleChecker
from app.dependencies.database import get_db
from app.schemas.admin_brokers import AdminBrokerListResponse
from app.services.admin_broker_service import AdminBrokerService

router = APIRouter(
    prefix="/admin/brokers",
    tags=["Admin Brokers"],
    dependencies=[Depends(RoleChecker([UserRole.ADMIN]))],
)


@router.get("", response_model=AdminBrokerListResponse)
def list_admin_brokers(
    db: Session = Depends(get_db),
) -> AdminBrokerListResponse:
    """Return broker configuration metadata and non-secret session health for ADMIN users."""
    return AdminBrokerService(db).list_brokers()
