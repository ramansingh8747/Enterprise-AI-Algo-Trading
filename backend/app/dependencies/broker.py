from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.dependencies.database import get_db
from app.repositories.broker_repository import BrokerRepository
from app.services.broker_service import BrokerService


from app.services.interfaces.broker_session_service import BrokerSessionServiceInterface
from app.dependencies.broker_session import get_broker_session_service
from app.services.broker_order_service import BrokerOrderService


# ---------------------------------------------------------------------------
# Repository factory
# ---------------------------------------------------------------------------

def get_broker_repository(db: Annotated[Session, Depends(get_db)]) -> BrokerRepository:
    """FastAPI dependency that constructs a scoped BrokerRepository."""
    return BrokerRepository(db)


# ---------------------------------------------------------------------------
# Service factory
# ---------------------------------------------------------------------------

def get_broker_service(
    repo: Annotated[BrokerRepository, Depends(get_broker_repository)],
) -> BrokerService:
    """FastAPI dependency that constructs a BrokerService."""
    return BrokerService(repo)


def get_broker_order_service(
    session_service: Annotated[BrokerSessionServiceInterface, Depends(get_broker_session_service)],
    broker_service: Annotated[BrokerService, Depends(get_broker_service)],
) -> BrokerOrderService:
    """FastAPI dependency that constructs a BrokerOrderService."""
    return BrokerOrderService(session_service=session_service, broker_service=broker_service)

