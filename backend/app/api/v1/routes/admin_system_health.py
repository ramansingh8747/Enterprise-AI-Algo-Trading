from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.dependencies.auth import RoleChecker
from app.dependencies.database import get_db
from app.database.models.user import UserRole
from app.schemas.admin_system_health import AdminSystemHealthResponse
from app.services.admin_system_health_service import AdminSystemHealthService

router = APIRouter(
    prefix="/admin/system-health",
    tags=["Admin System Health"],
    dependencies=[Depends(RoleChecker([UserRole.ADMIN]))],
)


def get_admin_system_health_service(
    request: Request,
    db: Session = Depends(get_db),
) -> AdminSystemHealthService:
    return AdminSystemHealthService(
        db=db,
        redis_transport=getattr(request.app.state, "redis_transport", None),
        websocket_manager=getattr(request.app.state, "websocket_manager", None),
    )


@router.get("", response_model=AdminSystemHealthResponse)
def get_system_health(
    service: Annotated[AdminSystemHealthService, Depends(get_admin_system_health_service)],
) -> AdminSystemHealthResponse:
    return service.check()
