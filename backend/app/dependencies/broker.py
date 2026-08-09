from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.dependencies.database import get_db
from app.repositories.broker_repository import BrokerRepository
from app.services.broker_service import BrokerService


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
