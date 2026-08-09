from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4
from app.database.models.broker_session import BrokerSession
from app.repositories.interfaces.broker_session_repository import BrokerSessionRepositoryInterface
from app.services.interfaces.broker_session_service import BrokerSessionServiceInterface
from app.core.security.encryption import EncryptionUtility

class BrokerSessionServiceImpl(BrokerSessionServiceInterface):
    """
    Implementation of BrokerSessionServiceInterface.
    """

    def __init__(
        self, 
        repository: BrokerSessionRepositoryInterface,
        encryption: EncryptionUtility
    ) -> None:
        self.repository = repository
        self.encryption = encryption

    def create_or_update_session(
        self,
        user_id: UUID,
        broker_id: UUID,
        access_token: str,
        expires_at: datetime
    ) -> BrokerSession:
        
        existing_session = self.repository.get_active_session(user_id, broker_id)
        encrypted_token = self.encryption.encrypt(access_token)
        
        if existing_session:
            existing_session.access_token = encrypted_token
            existing_session.expires_at = expires_at
            return self.repository.update_session(existing_session)
        else:
            new_session = BrokerSession(
                id=uuid4(),
                user_id=user_id,
                broker_id=broker_id,
                access_token=encrypted_token,
                expires_at=expires_at
            )
            return self.repository.create_session(new_session)

    def get_active_session(
        self,
        user_id: UUID,
        broker_id: UUID
    ) -> Optional[BrokerSession]:
        
        session = self.repository.get_active_session(user_id, broker_id)
        if session:
            # Create a detached copy to store the decrypted token safely,
            # leaving the original ORM-tracked session object in its encrypted state.
            decrypted_token = self.encryption.decrypt(session.access_token)
            
            # Detach object from SQLAlchemy session to prevent persistence of plaintext token
            # This is a safe way to return data while ensuring the DB entity remains untouched.
            from sqlalchemy import inspect
            inspector = inspect(session)
            if inspector.session:
                inspector.session.expunge(session)
                
            session.access_token = decrypted_token
            
        return session

    def get_session(self, session_id: UUID) -> Optional[BrokerSession]:
        return self.repository.get_by_id(BrokerSession, session_id)

    def revoke_session(self, session_id: UUID) -> None:
        self.repository.delete_session(session_id)
