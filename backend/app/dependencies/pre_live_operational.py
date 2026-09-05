from typing import Annotated
from fastapi import Depends
from sqlalchemy.orm import Session

from app.dependencies.database import get_db
from app.dependencies.broker_session import get_broker_session_service
from app.services.interfaces.broker_session_service import BrokerSessionServiceInterface
from app.services.pre_live_operational_service import PreLiveOperationalService


def get_pre_live_operational_service(
    db: Annotated[Session, Depends(get_db)],
    session_service: Annotated[BrokerSessionServiceInterface, Depends(get_broker_session_service)],
) -> PreLiveOperationalService:
    return PreLiveOperationalService(db=db, session_service=session_service)
