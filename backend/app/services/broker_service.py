from typing import List, Optional
from uuid import UUID
from app.database.models.broker import Broker
from app.repositories.broker_repository import BrokerRepository
from app.core.security.encryption import EncryptionUtility
from app.exceptions.auth_exceptions import BrokerAlreadyExistsException, BrokerNotFoundException


class BrokerService:
    """
    Business logic for broker management.
    """

    def __init__(
        self,
        repository: BrokerRepository,
    ) -> None:
        self.repository = repository
        self.encryption = EncryptionUtility()

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
