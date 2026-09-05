from typing import Optional, Tuple, List
from uuid import UUID
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import select, desc, or_
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
        found = self.db.execute(stmt).scalar_one_or_none()
        if not found:
            found = self.db.execute(select(StrategyInstance).where(StrategyInstance.id == instance_id)).scalar_one_or_none()
        return found

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
        self.db.commit()
        self.db.refresh(instance)
        return instance
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
        suggested_quantity: Optional[Decimal] = None,
        stop_loss: Optional[Decimal] = None,
        target: Optional[Decimal] = None,
        risk_reward: Optional[str] = None,
        reason: Optional[str] = None,
        indicators_json: Optional[str] = None,
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
            suggested_quantity=suggested_quantity or quantity,
            actual_quantity=None,
            order_type=order_type.upper(),
            price=price,
            stop_loss=stop_loss,
            target=target,
            risk_reward=risk_reward,
            reason=reason,
            indicators_json=indicators_json,
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

    def get_signal_by_id(self, signal_id: UUID, user_id: UUID) -> Optional[StrategySignal]:
        """Retrieves a StrategySignal verifying ownership."""
        stmt = select(StrategySignal).where(
            StrategySignal.id == signal_id,
            StrategySignal.user_id == user_id,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def update_signal_status(
        self,
        signal_id: UUID,
        user_id: UUID,
        status: str,
        actual_quantity: Optional[Decimal] = None,
        executed_order_id: Optional[str] = None,
    ) -> Optional[StrategySignal]:
        """Updates the status and actual execution details of a StrategySignal."""
        signal = self.get_signal_by_id(signal_id, user_id)
        if not signal:
            return None
        signal.status = status.upper()
        if actual_quantity is not None:
            signal.actual_quantity = actual_quantity
        if executed_order_id:
            signal.executed_order_id = executed_order_id
        signal.actioned_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(signal)
        return signal

    def list_pending_signals(self, user_id: UUID, limit: int = 100) -> List[StrategySignal]:
        """Lists pending proposed signals for a user, newest first."""
        stmt = (
            select(StrategySignal)
            .where(
                StrategySignal.user_id == user_id,
                StrategySignal.status.in_(["PROPOSED", "VIEWED"]),
            )
            .order_by(desc(StrategySignal.created_at))
            .limit(limit)
        )
        return list(self.db.execute(stmt).scalars().all())

    def has_active_proposed_signal(
        self, strategy_instance_id: UUID, symbol: str, side: str
    ) -> bool:
        """Returns True if an unresolved proposed signal already exists for this instance, symbol, and side."""
        stmt = (
            select(StrategySignal.id)
            .where(
                StrategySignal.strategy_instance_id == strategy_instance_id,
                StrategySignal.symbol == symbol.upper(),
                StrategySignal.side == side.upper(),
                StrategySignal.status.in_(["PROPOSED", "VIEWED"]),
            )
            .limit(1)
        )
        return self.db.execute(stmt).scalar_one_or_none() is not None

    def has_ignored_signal(
        self,
        strategy_instance_id: UUID,
        symbol: str,
        side: str,
        cooldown_seconds: int = 86400,
        user_id: Optional[UUID] = None,
    ) -> bool:
        """
        Returns True if a recently IGNORED signal exists for this instance/user, symbol, and side
        within the cooldown window (default 86400 seconds = 24 hours), preventing multiple cycles
        from recreating or re-notifying the same dismissed signal on that day.
        """
        conditions = [
            StrategySignal.symbol == symbol.upper(),
            StrategySignal.side == side.upper(),
            StrategySignal.status == "IGNORED",
        ]
        if user_id:
            conditions.append(StrategySignal.user_id == user_id)
        else:
            conditions.append(StrategySignal.strategy_instance_id == strategy_instance_id)

        stmt = (
            select(StrategySignal)
            .where(*conditions)
            .order_by(desc(StrategySignal.actioned_at), desc(StrategySignal.created_at))
            .limit(1)
        )
        signal = self.db.execute(stmt).scalar_one_or_none()
        if not signal:
            return False

        action_time = signal.actioned_at or signal.updated_at or signal.created_at
        if not action_time:
            return True

        if action_time.tzinfo is None:
            action_time = action_time.replace(tzinfo=timezone.utc)

        now = datetime.now(timezone.utc)
        elapsed = (now - action_time).total_seconds()
        return elapsed < cooldown_seconds

    def has_completed_daily_exit_or_target(
        self,
        strategy_instance_id: UUID,
        symbol: str,
        user_id: Optional[UUID] = None,
    ) -> bool:
        """
        Returns True if a SELL execution (target profit hit or stop loss exit)
        occurred today for this strategy instance and symbol, enforcing a single-trade-per-day
        rule so no further orders are placed after the trade completes.
        """
        try:
            from app.database.models.trading_execution import TradingExecution
            from app.services.market_timing_guard import MarketTimingGuard
            from datetime import time

            now_ist = MarketTimingGuard.get_ist_now()
            curr_time = now_ist.time()

            # Past 15:24 IST: all trading locked
            if curr_time > time(15, 24):
                return True

            is_hero_zero = time(15, 10) <= curr_time <= time(15, 24)

            now = datetime.now(timezone.utc)
            start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
            
            conditions = [
                TradingExecution.symbol == symbol.upper(),
                TradingExecution.side == "SELL",
                TradingExecution.executed_at >= start_of_day,
            ]
            if user_id:
                conditions.append(
                    or_(
                        TradingExecution.strategy_instance_id == strategy_instance_id,
                        TradingExecution.user_id == user_id,
                    )
                )
            else:
                conditions.append(TradingExecution.strategy_instance_id == strategy_instance_id)

            stmt = select(TradingExecution).where(*conditions)
            exec_rows = self.db.execute(stmt).scalars().all()
            total_execs = len(exec_rows)

            # Also check approved SELL StrategySignal today
            sig_conditions = [
                StrategySignal.symbol == symbol.upper(),
                StrategySignal.side == "SELL",
                StrategySignal.status == "APPROVED",
                StrategySignal.created_at >= start_of_day,
            ]
            if user_id:
                sig_conditions.append(StrategySignal.user_id == user_id)
            else:
                sig_conditions.append(StrategySignal.strategy_instance_id == strategy_instance_id)

            stmt_sig = select(StrategySignal).where(*sig_conditions)
            sig_rows = self.db.execute(stmt_sig).scalars().all()
            total_sigs = len(sig_rows)

            total_trades_today = max(total_execs, total_sigs)

            if is_hero_zero:
                # In Afternoon Hero-Zero slot: Max 2 trades total, and max 1 trade inside the hero-zero window
                if total_trades_today >= 2:
                    return True
                # Check if an afternoon exit already occurred after 15:10 IST
                for ex in exec_rows:
                    ex_ist = MarketTimingGuard.get_ist_now(ex.executed_at)
                    if ex_ist.time() >= time(15, 10):
                        return True
                for sg in sig_rows:
                    sg_ist = MarketTimingGuard.get_ist_now(sg.created_at)
                    if sg_ist.time() >= time(15, 10):
                        return True
                return False

            # In Morning / Pre-Hero-Zero sessions: Max 1 completed trade
            return total_trades_today >= 1
        except Exception:
            return False

    def has_recent_execution_or_signal(
        self,
        strategy_instance_id: UUID,
        symbol: str,
        cooldown_seconds: int = 300,
        user_id: Optional[UUID] = None,
        side: Optional[str] = None,
    ) -> bool:
        """
        Returns True if a recent trade execution or actioned/approved signal occurred for this
        strategy instance and symbol within the cooldown window (default 300 seconds = 5 minutes).
        Prevents whipsaw entries, intra-minute churning, and instant counter-trend entries.
        """
        if cooldown_seconds <= 0:
            return False

        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(seconds=cooldown_seconds)

        # 1. Check recent TradingExecution if available in db
        try:
            from app.database.models.trading_execution import TradingExecution
            exec_conditions = [
                TradingExecution.symbol == symbol.upper(),
                TradingExecution.executed_at >= cutoff,
            ]
            if side:
                exec_conditions.append(TradingExecution.side == side.upper())
            if user_id:
                exec_conditions.append(
                    or_(
                        TradingExecution.strategy_instance_id == strategy_instance_id,
                        TradingExecution.user_id == user_id,
                    )
                )
            else:
                exec_conditions.append(TradingExecution.strategy_instance_id == strategy_instance_id)

            stmt_exec = (
                select(TradingExecution.id)
                .where(*exec_conditions)
                .limit(1)
            )
            if self.db.execute(stmt_exec).scalar_one_or_none() is not None:
                return True
        except Exception:
            pass

        # 2. Check recent approved or executed signals
        sig_conditions = [
            StrategySignal.symbol == symbol.upper(),
            StrategySignal.status.in_(["APPROVED", "EXECUTED"]),
        ]
        if side:
            sig_conditions.append(StrategySignal.side == side.upper())
        if user_id:
            sig_conditions.append(
                or_(
                    StrategySignal.strategy_instance_id == strategy_instance_id,
                    StrategySignal.user_id == user_id,
                )
            )
        else:
            sig_conditions.append(StrategySignal.strategy_instance_id == strategy_instance_id)

        stmt_sig = (
            select(StrategySignal)
            .where(*sig_conditions)
            .order_by(desc(StrategySignal.actioned_at), desc(StrategySignal.created_at))
            .limit(1)
        )
        signal = self.db.execute(stmt_sig).scalar_one_or_none()
        if not signal:
            return False

        action_time = signal.actioned_at or signal.created_at
        if not action_time:
            return True

        if action_time.tzinfo is None:
            action_time = action_time.replace(tzinfo=timezone.utc)

        elapsed = (now - action_time).total_seconds()
        return elapsed < cooldown_seconds

    def mark_execution(self, instance_id: UUID, user_id: UUID) -> None:
        """Persist the latest successful scheduler execution timestamp."""
        instance = self.get_instance_for_user(instance_id, user_id)
        if not instance:
            return
        instance.last_execution_at = datetime.now(timezone.utc)
        self.db.commit()

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


    def list_all_definitions(self) -> List[StrategyDefinition]:
        stmt = select(StrategyDefinition).order_by(desc(StrategyDefinition.created_at))
        return list(self.db.execute(stmt).scalars().all())

    def get_definition_by_id(self, definition_id: UUID) -> Optional[StrategyDefinition]:
        stmt = select(StrategyDefinition).where(StrategyDefinition.id == definition_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def get_definition_for_user(
        self, definition_id: UUID, user_id: UUID
    ) -> Optional[StrategyDefinition]:
        """Retrieves a StrategyDefinition verifying ownership or fallback."""
        stmt = select(StrategyDefinition).where(
            StrategyDefinition.id == definition_id,
            StrategyDefinition.user_id == user_id,
        )
        found = self.db.execute(stmt).scalar_one_or_none()
        if not found:
            found = self.db.execute(select(StrategyDefinition).where(StrategyDefinition.id == definition_id)).scalar_one_or_none()
        return found

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
        """Lists all StrategyInstances for a given definition."""
        stmt = (
            select(StrategyInstance)
            .where(
                StrategyInstance.strategy_definition_id == definition_id,
            )
            .order_by(desc(StrategyInstance.created_at))
        )
        return list(self.db.execute(stmt).scalars().all())

    def get_all_running_instances(self) -> List[StrategyInstance]:
        """Returns all active StrategyInstances across the system in RUNNING state with active definitions."""
        from app.database.models.strategy import StrategyDefinition
        stmt = (
            select(StrategyInstance)
            .join(StrategyDefinition, StrategyInstance.strategy_definition_id == StrategyDefinition.id)
            .where(StrategyInstance.status == "RUNNING", StrategyDefinition.is_active == True)
        )
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
