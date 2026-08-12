from typing import Optional, Tuple, List
from uuid import UUID
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import select, desc
from sqlalchemy.exc import IntegrityError

from app.database.repositories.base_repository import BaseRepository
from app.database.models.strategy import StrategyDefinition, StrategyInstance, StrategySignal
from app.exceptions.strategy_exceptions import InvalidLifecycleTransitionException


VALID_LIFECYCLE_TRANSITIONS = {
    "DRAFT": ["READY", "STOPPED"],
    "READY": ["RUNNING", "STOPPED"],
    "RUNNING": ["PAUSED", "STOPPED", "FAILED"],
    "PAUSED": ["RUNNING", "STOPPED"],
    "STOPPED": ["READY", "DRAFT"],
    "FAILED": ["STOPPED", "DRAFT"],
}


class StrategyRepository(BaseRepository[StrategyInstance]):
    """Repository managing persistence and lifecycle for strategy instances and signals."""

    def __init__(self, db: Session) -> None:
        super().__init__(model=StrategyInstance, db=db)

    def get_instance_for_user(self, instance_id: UUID, user_id: UUID) -> Optional[StrategyInstance]:
        """Retrieves a StrategyInstance verifying ownership."""
        stmt = select(StrategyInstance).where(
            StrategyInstance.id == instance_id,
            StrategyInstance.user_id == user_id,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def update_instance_status(
        self,
        instance_id: UUID,
        user_id: UUID,
        new_status: str,
        error_message: Optional[str] = None
    ) -> StrategyInstance:
        """Updates strategy instance status enforcing valid state transitions."""
        instance = self.get_instance_for_user(instance_id, user_id)
        if not instance:
            raise ValueError(f"Strategy instance {instance_id} not found for user {user_id}")

        current_status = instance.status.upper()
        target_status = new_status.upper()

        allowed = VALID_LIFECYCLE_TRANSITIONS.get(current_status, [])
        if target_status not in allowed:
            raise InvalidLifecycleTransitionException(
                f"Cannot transition strategy instance from {current_status} to {target_status}."
            )

        instance.status = target_status
        if error_message:
            instance.error_message = error_message

        if target_status == "RUNNING" and not instance.started_at:
            instance.started_at = datetime.now(timezone.utc)
        elif target_status in ("STOPPED", "FAILED"):
            instance.stopped_at = datetime.now(timezone.utc)

        self.db.commit()
        self.db.refresh(instance)
        return instance

    def create_signal_if_not_exists(
        self,
        strategy_instance_id: UUID,
        user_id: UUID,
        broker_id: UUID,
        symbol: str,
        side: str,
        quantity: Decimal,
        order_type: str,
        price: Optional[Decimal],
        signal_fingerprint: str,
    ) -> Tuple[StrategySignal, bool]:
        """
        Atomically gets or creates a StrategySignal using database uniqueness constraint.
        Returns (signal_record, is_newly_created).
        """
        stmt = select(StrategySignal).where(
            StrategySignal.strategy_instance_id == strategy_instance_id,
            StrategySignal.signal_fingerprint == signal_fingerprint,
        )
        existing = self.db.execute(stmt).scalar_one_or_none()
        if existing:
            return existing, False

        signal_record = StrategySignal(
            strategy_instance_id=strategy_instance_id,
            user_id=user_id,
            broker_id=broker_id,
            symbol=symbol,
            side=side.upper(),
            quantity=quantity,
            order_type=order_type.upper(),
            price=price,
            signal_fingerprint=signal_fingerprint,
            status="PROPOSED",
        )

        try:
            self.db.add(signal_record)
            self.db.commit()
            self.db.refresh(signal_record)
            return signal_record, True
        except IntegrityError:
            self.db.rollback()
            existing = self.db.execute(stmt).scalar_one_or_none()
            return existing, False

    # -----------------------------------------------------------------------
    # StrategyDefinition CRUD
    # -----------------------------------------------------------------------

    def create_definition(
        self,
        user_id: UUID,
        name: str,
        strategy_type: str = "DETERMINISTIC_MOMENTUM",
        config_json: Optional[str] = None,
    ) -> StrategyDefinition:
        """Creates and persists a new StrategyDefinition owned by the given user."""
        definition = StrategyDefinition(
            user_id=user_id,
            name=name,
            strategy_type=strategy_type,
            config_json=config_json,
            is_active=True,
        )
        self.db.add(definition)
        self.db.commit()
        self.db.refresh(definition)
        return definition

    def list_definitions_for_user(self, user_id: UUID) -> List[StrategyDefinition]:
        """Returns all StrategyDefinitions owned by the given user, newest first."""
        stmt = (
            select(StrategyDefinition)
            .where(StrategyDefinition.user_id == user_id)
            .order_by(desc(StrategyDefinition.created_at))
        )
        return list(self.db.execute(stmt).scalars().all())

    def get_definition_for_user(
        self, definition_id: UUID, user_id: UUID
    ) -> Optional[StrategyDefinition]:
        """Retrieves a StrategyDefinition verifying ownership. Returns None if not found or not owned."""
        stmt = select(StrategyDefinition).where(
            StrategyDefinition.id == definition_id,
            StrategyDefinition.user_id == user_id,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def update_definition(
        self,
        definition_id: UUID,
        user_id: UUID,
        updates: dict,
    ) -> Optional[StrategyDefinition]:
        """Updates allowed fields on a StrategyDefinition. Returns None if not found/not owned."""
        definition = self.get_definition_for_user(definition_id, user_id)
        if not definition:
            return None

        allowed_fields = {"name", "strategy_type", "config_json", "is_active"}
        for field, value in updates.items():
            if field in allowed_fields:
                setattr(definition, field, value)

        self.db.commit()
        self.db.refresh(definition)
        return definition

    def delete_definition(
        self, definition_id: UUID, user_id: UUID
    ) -> bool:
        """Permanently deletes a StrategyDefinition (cascades to instances and signals).
        Returns True if deleted, False if not found/not owned.
        """
        definition = self.get_definition_for_user(definition_id, user_id)
        if not definition:
            return False

        self.db.delete(definition)
        self.db.commit()
        return True

    # -----------------------------------------------------------------------
    # StrategyInstance queries
    # -----------------------------------------------------------------------

    def create_instance(
        self,
        definition_id: UUID,
        user_id: UUID,
        broker_id: UUID,
        execution_mode: str = "PAPER",
    ) -> StrategyInstance:
        """Creates a new StrategyInstance in DRAFT state."""
        instance = StrategyInstance(
            strategy_definition_id=definition_id,
            user_id=user_id,
            broker_id=broker_id,
            execution_mode=execution_mode.upper(),
            status="DRAFT",
        )
        self.db.add(instance)
        self.db.commit()
        self.db.refresh(instance)
        return instance

    def list_instances_for_definition(
        self, definition_id: UUID, user_id: UUID
    ) -> List[StrategyInstance]:
        """Lists all StrategyInstances for a given definition, scoped by user ownership."""
        stmt = (
            select(StrategyInstance)
            .where(
                StrategyInstance.strategy_definition_id == definition_id,
                StrategyInstance.user_id == user_id,
            )
            .order_by(desc(StrategyInstance.created_at))
        )
        return list(self.db.execute(stmt).scalars().all())

    def get_all_running_instances(self) -> List[StrategyInstance]:
        """Returns all active StrategyInstances across the system in RUNNING state for scheduler execution."""
        stmt = select(StrategyInstance).where(StrategyInstance.status == "RUNNING")
        return list(self.db.execute(stmt).scalars().all())

    # -----------------------------------------------------------------------
    # StrategySignal queries
    # -----------------------------------------------------------------------

    def list_signals_for_instance(
        self, instance_id: UUID, user_id: UUID, limit: int = 100
    ) -> List[StrategySignal]:
        """Returns signal history for an instance the user owns, newest first."""
        stmt = (
            select(StrategySignal)
            .where(
                StrategySignal.strategy_instance_id == instance_id,
                StrategySignal.user_id == user_id,
            )
            .order_by(desc(StrategySignal.created_at))
            .limit(limit)
        )
        return list(self.db.execute(stmt).scalars().all())
