from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.v1.routes.auth import get_current_active_user
from app.database.models.user import UserRole
from app.dependencies.admin_live_gate import get_admin_live_gate_service
from app.dependencies.auth import RoleChecker
from app.schemas.admin_live_gate import AdminLiveGateResponse
from app.schemas.auth import UserResponse
from app.services.admin_live_gate_service import AdminLiveGateService
from app.services.live_activation_service import LiveActivationService
from app.dependencies.live_activation import get_live_activation_service
from app.schemas.live_activation import LiveActivationResponse

router = APIRouter(
    prefix="/admin/live-gate",
    tags=["Admin LIVE Gate"],
    dependencies=[Depends(RoleChecker([UserRole.ADMIN]))],
)


@router.get("/{broker_id}", response_model=AdminLiveGateResponse)
async def evaluate_live_gate(
    broker_id: UUID,
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
    service: Annotated[AdminLiveGateService, Depends(get_admin_live_gate_service)],
    probe_broker: bool = Query(True, description="Run the existing read-only broker probe when supported."),
) -> AdminLiveGateResponse:
    return await service.evaluate(current_user.id, broker_id, probe_broker=probe_broker)


@router.post("/{broker_id}/authorize", response_model=LiveActivationResponse)
async def authorize_live_gate(
    broker_id: UUID,
    confirmed: bool = Query(False, description="Explicit administrator confirmation. This endpoint never enables LIVE trading."),
    current_user: Annotated[UserResponse, Depends(get_current_active_user)] = None,
    service: Annotated[LiveActivationService, Depends(get_live_activation_service)] = None,
) -> LiveActivationResponse:
    return await service.authorize(user_id=current_user.id, broker_id=broker_id, confirmed=confirmed)
