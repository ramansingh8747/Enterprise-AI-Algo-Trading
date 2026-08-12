from typing import List, Optional, Any
from uuid import UUID
from app.database.models.broker import Broker
from app.repositories.broker_repository import BrokerRepository
from app.core.security.encryption import EncryptionUtility
from app.exceptions.auth_exceptions import BrokerAlreadyExistsException, BrokerNotFoundException
from app.brokers.interfaces.broker_interface import BrokerInterface
from app.brokers.factory import BrokerFactory
from app.services.interfaces.broker_session_service import BrokerSessionServiceInterface


class BrokerService:
    """
    Business logic for broker management and data.
    """

    def __init__(
        self,
        repository: BrokerRepository,
        session_service: Optional[BrokerSessionServiceInterface] = None,
        broker_factory: Optional[BrokerFactory] = None,
    ) -> None:
        self.repository = repository
        self.encryption = EncryptionUtility()
        self.session_service = session_service
        self.broker_factory = broker_factory

    def _get_provider(self, user_id: UUID, broker_id: UUID) -> BrokerInterface:
        if not self.session_service or not self.broker_factory:
            raise ValueError("BrokerService not initialized with data provider dependencies.")
        
        # Verify the user has an active session for this broker
        session = self.session_service.get_active_session(user_id, broker_id)
        if not session:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="No active session found for this broker."
            )
        
        broker = self.get_broker(broker_id)
        provider = self.broker_factory.get_provider(
            provider_name=broker.broker_type,
            session_service=self.session_service,
            broker_id=broker_id
        )
        if hasattr(provider, "set_user_context"):
            provider.set_user_context(user_id)
        return provider

    def get_profile(self, user_id: UUID, broker_id: UUID) -> Any:
        provider = self._get_provider(user_id, broker_id)
        provider.set_user_context(user_id)
        return provider.get_profile()

    def get_holdings(self, user_id: UUID, broker_id: UUID) -> Any:
        provider = self._get_provider(user_id, broker_id)
        provider.set_user_context(user_id)
        return provider.get_holdings()

    def get_positions(self, user_id: UUID, broker_id: UUID) -> Any:
        provider = self._get_provider(user_id, broker_id)
        provider.set_user_context(user_id)
        return provider.get_positions()

    def get_orders(self, user_id: UUID, broker_id: UUID) -> Any:
        provider = self._get_provider(user_id, broker_id)
        provider.set_user_context(user_id)
        return provider.get_orders()

    def get_quotes(self, user_id: UUID, broker_id: UUID, symbols: List[str]) -> Any:
        provider = self._get_provider(user_id, broker_id)
        provider.set_user_context(user_id)
        return provider.get_quotes(symbols)

    def create_broker(self, broker_data: dict) -> Broker:
        """Create a new broker."""
        if self.repository.get_by_broker_name(broker_data['broker_name']):
            raise BrokerAlreadyExistsException(broker_data['broker_name'])
        
        broker_data['api_secret'] = self.encryption.encrypt(broker_data['api_secret'])
        broker = Broker(**broker_data)
        return self.repository.create(broker)

    def get_broker(self, broker_id: UUID) -> Broker:
        """Get a broker by ID."""
        broker = self.repository.get_by_id(Broker, broker_id)
        if not broker:
            raise BrokerNotFoundException(str(broker_id))
        return broker

    def list_brokers(self) -> List[Broker]:
        """List all brokers."""
        return self.repository.get_all(Broker)

    def update_broker(self, broker_id: UUID, broker_data: dict) -> Broker:
        """Update an existing broker."""
        broker = self.get_broker(broker_id)
        
        if 'api_secret' in broker_data:
            broker_data['api_secret'] = self.encryption.encrypt(broker_data['api_secret'])

        for key, value in broker_data.items():
            setattr(broker, key, value)
            
        return self.repository.update(broker)

    def delete_broker(self, broker_id: UUID) -> None:
        """Delete a broker."""
        broker = self.get_broker(broker_id)
        self.repository.delete(broker)

    def get_decrypted_secret(self, broker_id: UUID) -> str:
        """Get decrypted api_secret."""
        broker = self.get_broker(broker_id)
        return self.encryption.decrypt(broker.api_secret)
