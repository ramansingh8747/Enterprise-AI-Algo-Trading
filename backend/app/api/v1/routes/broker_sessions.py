from typing import Annotated, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, status, HTTPException
from app.api.v1.routes.auth import get_current_active_user
from app.schemas.auth import UserResponse
from app.schemas.broker_session import BrokerSessionCreate, BrokerSessionResponse
from app.services.interfaces.broker_session_service import BrokerSessionServiceInterface
from app.dependencies.broker_session import get_broker_session_service

router = APIRouter(
    prefix="/broker-sessions",
    tags=["Broker Sessions"],
)

@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=BrokerSessionResponse,
    summary="Create or update a broker session",
)
def create_or_update_session(
    payload: BrokerSessionCreate,
    service: Annotated[BrokerSessionServiceInterface, Depends(get_broker_session_service)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> BrokerSessionResponse:
    session = service.create_or_update_session(
        user_id=current_user.id,
        broker_id=payload.broker_id,
        access_token=payload.access_token,
        expires_at=payload.expires_at,
    )
    return BrokerSessionResponse.model_validate(session)

@router.get(
    "/{broker_id}",
    status_code=status.HTTP_200_OK,
    response_model=BrokerSessionResponse,
    summary="Get active broker session",
)
def get_active_session(
    broker_id: UUID,
    service: Annotated[BrokerSessionServiceInterface, Depends(get_broker_session_service)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
) -> BrokerSessionResponse:
    session = service.get_active_session(user_id=current_user.id, broker_id=broker_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active session found.")
    return BrokerSessionResponse.model_validate(session)

@router.delete(
    "/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke broker session",
)
def revoke_session(
    session_id: UUID,
    service: Annotated[BrokerSessionServiceInterface, Depends(get_broker_session_service)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
):
    # Verify authorization
    session = service.get_session(session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    
    service.revoke_session(session_id)
    return None
