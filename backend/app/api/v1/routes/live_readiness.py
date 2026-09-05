from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.v1.routes.auth import get_current_active_user
from app.dependencies.auth import RoleChecker
from app.dependencies.live_readiness import get_live_readiness_service
from app.database.models.user import UserRole
from app.schemas.auth import UserResponse
from app.schemas.live_readiness import LiveReadinessResponse
from app.services.live_readiness_service import LiveReadinessService

router = APIRouter(
    prefix="/admin/live-readiness",
    tags=["Live Readiness"],
    dependencies=[Depends(RoleChecker([UserRole.ADMIN]))],
)


@router.get("/{broker_id}", response_model=LiveReadinessResponse)
async def verify_live_readiness(
    broker_id: UUID,
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
    service: Annotated[LiveReadinessService, Depends(get_live_readiness_service)],
    probe_broker: bool = Query(False, description="Run a read-only Zerodha profile probe; never places an order."),
) -> LiveReadinessResponse:
    """Run readiness checks. Optional broker probe is strictly read-only."""
    return await service.verify(user_id=current_user.id, broker_id=broker_id, probe_broker=probe_broker)
