from datetime import datetime, timezone
from uuid import UUID
from typing import Optional
from sqlalchemy.orm import Session
from app.repositories.generic_repository import GenericRepository
from app.repositories.interfaces.broker_session_repository import BrokerSessionRepositoryInterface
from app.database.models.broker_session import BrokerSession

class BrokerSessionRepositoryImpl(GenericRepository, BrokerSessionRepositoryInterface):
    """
    Implementation of BrokerSessionRepositoryInterface.
    """

    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def create_session(self, session: BrokerSession) -> BrokerSession:
        return super().create(session)

    def get_active_session(self, user_id: UUID, broker_id: UUID) -> Optional[BrokerSession]:
        return (
            self.db.query(BrokerSession)
            .filter(
                BrokerSession.user_id == user_id,
                BrokerSession.broker_id == broker_id,
                BrokerSession.expires_at > datetime.now(timezone.utc)
            )
            .first()
        )

    def update_session(self, session: BrokerSession) -> BrokerSession:
        return super().update(session)

    def delete_session(self, session_id: UUID) -> None:
        session = self.get_by_id(BrokerSession, session_id)
        if session:
            super().delete(session)
