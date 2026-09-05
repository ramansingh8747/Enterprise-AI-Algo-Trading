from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.v1.routes.auth import get_current_active_user
from app.database.models.user import UserRole
from app.dependencies.auth import RoleChecker
from app.dependencies.pre_live_operational import get_pre_live_operational_service
from app.schemas.auth import UserResponse
from app.schemas.pre_live_operational import PreLiveOperationalResponse
from app.services.pre_live_operational_service import PreLiveOperationalService

router = APIRouter(
    prefix="/admin/pre-live-operational",
    tags=["Pre-Live Operational Verification"],
    dependencies=[Depends(RoleChecker([UserRole.ADMIN]))],
)


@router.get("/{broker_id}", response_model=PreLiveOperationalResponse)
async def verify_pre_live_operational(
    broker_id: UUID,
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
    service: Annotated[PreLiveOperationalService, Depends(get_pre_live_operational_service)],
) -> PreLiveOperationalResponse:
    """Run read-only operational hardening checks and simulated failure drills."""
    return await service.verify(user_id=current_user.id, broker_id=broker_id)
