import uuid
from typing import Optional, Tuple
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.logging.logger import logger
from app.database.models.order_idempotency import OrderIdempotencyRecord
from app.database.repositories.base_repository import BaseRepository
from app.exceptions.base_exception import BaseAppException


class OrderIdempotencyRepository(BaseRepository[OrderIdempotencyRecord]):
    """
    Repository layer for managing OrderIdempotencyRecord database persistence.
    Provides atomic concurrency protection via unique constraints.
    """

    def __init__(self, db: Session) -> None:
        super().__init__(OrderIdempotencyRecord, db)

    def get_record(
        self,
        user_id: UUID,
        broker_id: UUID,
        idempotency_key: str,
    ) -> Optional[OrderIdempotencyRecord]:
        """Fetch existing idempotency record scoped to (user_id, broker_id, idempotency_key)."""
        stmt = select(OrderIdempotencyRecord).where(
            OrderIdempotencyRecord.user_id == user_id,
            OrderIdempotencyRecord.broker_id == broker_id,
            OrderIdempotencyRecord.idempotency_key == idempotency_key,
        )
        return self.db.scalars(stmt).first()

    def get_or_create_pending(
        self,
        user_id: UUID,
        broker_id: UUID,
        idempotency_key: str,
        request_hash: str,
    ) -> Tuple[OrderIdempotencyRecord, bool]:
        """
        Atomically gets or creates an idempotency record in 'PENDING' status.

        Returns:
            Tuple of (record, created_is_true).
            If created_is_true == True, the caller has acquired execution rights for this idempotency key.
            If created_is_true == False, an existing record was found.
        """
        existing = self.get_record(user_id, broker_id, idempotency_key)
        if existing:
            return existing, False

        new_record = OrderIdempotencyRecord(
            id=uuid.uuid4(),
            user_id=user_id,
            broker_id=broker_id,
            idempotency_key=idempotency_key,
            request_hash=request_hash,
            status="PENDING",
        )

        try:
            self.db.add(new_record)
            self.db.commit()
            self.db.refresh(new_record)
            return new_record, True
        except IntegrityError:
            self.db.rollback()
            # Concurrent insert occurred, fetch existing record
            existing = self.get_record(user_id, broker_id, idempotency_key)
            if existing:
                return existing, False
            raise BaseAppException(
                message="Database integrity error handling idempotency record.",
                status_code=500,
            )
        except SQLAlchemyError as e:
            self.db.rollback()
            logger.exception("Error creating OrderIdempotencyRecord")
            raise BaseAppException(
                message="Could not save idempotency record.",
                status_code=500,
                details=str(e),
            )

    def mark_completed(
        self,
        record_id: UUID,
        order_id: Optional[str],
        response_payload: str,
    ) -> OrderIdempotencyRecord:
        """Mark idempotency record as COMPLETED with serialized response."""
        record = self.get_by_id(record_id)
        if not record:
            raise BaseAppException(message="Idempotency record not found.", status_code=404)

        record.status = "COMPLETED"
        record.order_id = order_id
        record.response_payload = response_payload

        try:
            self.db.add(record)
            self.db.commit()
            self.db.refresh(record)
            return record
        except SQLAlchemyError as e:
            self.db.rollback()
            logger.exception("Error marking OrderIdempotencyRecord as completed")
            raise BaseAppException(
                message="Could not update idempotency record status.",
                status_code=500,
                details=str(e),
            )

    def mark_failed(
        self,
        record_id: UUID,
        response_payload: str,
    ) -> OrderIdempotencyRecord:
        """Mark idempotency record as FAILED with serialized error message."""
        record = self.get_by_id(record_id)
        if not record:
            raise BaseAppException(message="Idempotency record not found.", status_code=404)

        record.status = "FAILED"
        record.response_payload = response_payload

        try:
            self.db.add(record)
            self.db.commit()
            self.db.refresh(record)
            return record
        except SQLAlchemyError as e:
            self.db.rollback()
            logger.exception("Error marking OrderIdempotencyRecord as failed")
            raise BaseAppException(
                message="Could not update idempotency record status.",
                status_code=500,
                details=str(e),
            )
