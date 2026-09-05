from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.v1.routes.auth import get_current_active_user
from app.dependencies.auth import RoleChecker
from app.dependencies.live_activation import get_live_activation_service
from app.database.models.user import UserRole
from app.schemas.auth import UserResponse
from app.schemas.live_activation import LiveActivationResponse
from app.services.live_activation_service import LiveActivationService

router = APIRouter(
    prefix="/admin/live-activation",
    tags=["Live Activation"],
    dependencies=[Depends(RoleChecker([UserRole.ADMIN]))],
)


@router.post("/{broker_id}/authorize", response_model=LiveActivationResponse)
async def authorize_live_activation(
    broker_id: UUID,
    confirmed: bool = Query(False, description="Explicit administrator confirmation; this endpoint still never enables LIVE."),
    current_user: Annotated[UserResponse, Depends(get_current_active_user)] = None,
    service: Annotated[LiveActivationService, Depends(get_live_activation_service)] = None,
) -> LiveActivationResponse:
    return await service.authorize(user_id=current_user.id, broker_id=broker_id, confirmed=confirmed)
