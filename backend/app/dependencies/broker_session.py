from typing import Annotated
from fastapi import Depends
from sqlalchemy.orm import Session
from app.dependencies.database import get_db
from app.repositories.implementations.broker_session_repository_impl import BrokerSessionRepositoryImpl
from app.services.implementations.broker_session_service_impl import BrokerSessionServiceImpl
from app.core.security.encryption import EncryptionUtility

def get_broker_session_repository(db: Annotated[Session, Depends(get_db)]) -> BrokerSessionRepositoryImpl:
    """FastAPI dependency that constructs a scoped BrokerSessionRepository."""
    return BrokerSessionRepositoryImpl(db)

def get_broker_session_service(
    repository: Annotated[BrokerSessionRepositoryImpl, Depends(get_broker_session_repository)],
) -> BrokerSessionServiceImpl:
    """FastAPI dependency that constructs a scoped BrokerSessionService."""
    encryption = EncryptionUtility()
    return BrokerSessionServiceImpl(repository, encryption)
