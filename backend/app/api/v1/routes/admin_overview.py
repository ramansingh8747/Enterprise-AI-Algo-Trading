from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database.models.user import UserRole
from app.dependencies.auth import RoleChecker
from app.dependencies.database import get_db
from app.schemas.admin_overview import AdminOverviewResponse
from app.services.admin_overview_service import AdminOverviewService
from app.services.admin_system_health_service import AdminSystemHealthService

router = APIRouter(
    prefix="/admin/overview",
    tags=["Admin Overview"],
    dependencies=[Depends(RoleChecker([UserRole.ADMIN]))],
)


def get_admin_overview_service(
    request: Request,
    db: Session = Depends(get_db),
) -> AdminOverviewService:
    health_service = AdminSystemHealthService(
        db=db,
        redis_transport=getattr(request.app.state, "redis_transport", None),
        websocket_manager=getattr(request.app.state, "websocket_manager", None),
    )
    return AdminOverviewService(db=db, health_service=health_service)


@router.get("", response_model=AdminOverviewResponse)
def get_admin_overview(
    service: Annotated[AdminOverviewService, Depends(get_admin_overview_service)],
) -> AdminOverviewResponse:
    return service.build()
