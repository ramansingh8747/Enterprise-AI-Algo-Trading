from typing import Optional
from sqlalchemy.orm import Session
from app.repositories.generic_repository import GenericRepository
from app.database.models.broker import Broker


class BrokerRepository(GenericRepository):
    """
    Repository for broker database operations.
    """

    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get_by_broker_name(self, broker_name: str) -> Optional[Broker]:
        """Retrieve a broker by its name."""
        return self.db.query(Broker).filter(Broker.broker_name == broker_name).first()
