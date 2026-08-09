from typing import Annotated
from uuid import UUID
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.dependencies.database import get_db
from app.dependencies.auth import get_current_active_user
from app.schemas.auth import UserResponse
from app.repositories.broker_repository import BrokerRepository
from app.services.interfaces.broker_session_service import BrokerSessionServiceInterface
from app.dependencies.broker_session import get_broker_session_service
from app.brokers.interfaces.broker_interface import BrokerInterface
from app.brokers.providers.zerodha.zerodha_broker import ZerodhaBroker

def get_broker_provider(
    broker_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[UserResponse, Depends(get_current_active_user)],
    session_service: Annotated[BrokerSessionServiceInterface, Depends(get_broker_session_service)],
) -> BrokerInterface:
    """FastAPI dependency that constructs a request-scoped broker provider with authorization."""
    repo = BrokerRepository(db)
    broker = repo.get_by_id(broker_id)

    if not broker or not broker.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Broker not found or inactive."
        )

    # Verify the user has an active session for this broker
    session = session_service.get_active_session(current_user.id, broker_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No active session found for this broker."
        )

    if broker.broker_type == "zerodha":
        provider = ZerodhaBroker(session_service=session_service, broker_id=broker_id)
        provider.set_user_context(current_user.id)
        return provider
    else:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=f"Provider {broker.broker_type} not supported."
        )
