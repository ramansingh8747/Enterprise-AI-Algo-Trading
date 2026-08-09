from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional
from uuid import UUID
from app.database.models.broker_session import BrokerSession

class BrokerSessionServiceInterface(ABC):
    """
    Interface for BrokerSession service operations.
    """

    @abstractmethod
    def create_or_update_session(
        self,
        user_id: UUID,
        broker_id: UUID,
        access_token: str,
        expires_at: datetime
    ) -> BrokerSession:
        """Create or update a broker session."""
        pass

    @abstractmethod
    def get_active_session(
        self,
        user_id: UUID,
        broker_id: UUID
    ) -> Optional[BrokerSession]:
        """Retrieve an active broker session."""
        pass

    @abstractmethod
    def get_session(self, session_id: UUID) -> Optional[BrokerSession]:
        """Retrieve a broker session by ID."""
        pass

    @abstractmethod
    def revoke_session(self, session_id: UUID) -> None:
        """Revoke a broker session."""
        pass
