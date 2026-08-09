from abc import ABC, abstractmethod
from uuid import UUID
from typing import Optional
from app.database.models.broker_session import BrokerSession

class BrokerSessionRepositoryInterface(ABC):
    """
    Interface for BrokerSession repository operations.
    """

    @abstractmethod
    def create_session(self, session: BrokerSession) -> BrokerSession:
        """Persist a new broker session."""
        pass

    @abstractmethod
    def get_active_session(self, user_id: UUID, broker_id: UUID) -> Optional[BrokerSession]:
        """Retrieve an active broker session for a user and broker."""
        pass

    @abstractmethod
    def update_session(self, session: BrokerSession) -> BrokerSession:
        """Update an existing broker session."""
        pass

    @abstractmethod
    def delete_session(self, session_id: UUID) -> None:
        """Delete a broker session."""
        pass
