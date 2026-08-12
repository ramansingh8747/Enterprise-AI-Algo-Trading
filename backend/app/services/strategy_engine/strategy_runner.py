import asyncio
import hashlib
import json
import logging
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timezone
from decimal import Decimal

from app.database.repositories.strategy_repository import StrategyRepository
from app.services.strategy_engine.base_strategy import BaseStrategy, DeterministicMomentumStrategy
from app.services.broker_order_service import BrokerOrderService
from app.brokers.base.broker_types import BrokerOrderRequest, BrokerOrder
from app.exceptions.strategy_exceptions import (
    StaleDataException,
    DuplicateSignalException,
    BaseStrategyException,
)

import uuid
from app.services.event_bus.interfaces import EventPublisher
from app.services.event_bus.models import Event, EventType
from app.services.event_bus.topics import Topic
from app.database.models.strategy import StrategyInstance

from app.services.paper_accounting_service import PaperAccountingService

logger = logging.getLogger(__name__)


class StrategyRunner:
    """
    Server-side Strategy Engine Runner.
    Orchestrates market data evaluation, stale data validation, signal generation,
    signal deduplication, paper/live mode isolation, RiskEngine execution, broker order routing,
    and real-time event publication.
    """

    def __init__(
        self,
        repository: StrategyRepository,
        broker_order_service: Optional[BrokerOrderService] = None,
        paper_accounting_service: Optional[PaperAccountingService] = None,
        max_data_age_seconds: int = 10,
        event_publisher: Optional[EventPublisher] = None,
    ) -> None:
        self._repository = repository
        self._broker_order_service = broker_order_service
        self._paper_accounting_service = paper_accounting_service
        self.max_data_age_seconds = max_data_age_seconds
        self._event_publisher = event_publisher

    def _publish_event(
        self,
        event_type: EventType,
        user_id: UUID,
        strategy_instance_id: UUID,
        strategy_id: Optional[UUID] = None,
        broker_id: Optional[UUID] = None,
        symbol: Optional[str] = None,
        execution_mode: Optional[str] = None,
        payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Publishes an event to the EventBus if an event publisher is configured.
        FAIL-SAFE: Any failure during event construction or publishing is caught, logged,
        and ignored so it NEVER interrupts strategy execution or state changes.
        """
        if not self._event_publisher:
            return

        try:
            event = Event(
                event_id=uuid.uuid4(),
                event_type=event_type,
                timestamp=datetime.now(timezone.utc),
                user_id=user_id,
                strategy_instance_id=strategy_instance_id,
                strategy_id=strategy_id,
                broker_id=broker_id,
                symbol=symbol,
                execution_mode=execution_mode,
                payload=payload or {},
            )

            topic = Topic.strategy(strategy_instance_id)

            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None

            if loop and loop.is_running():
                loop.create_task(self._async_publish(topic, event))
            else:
                asyncio.run(self._async_publish(topic, event))
        except Exception as exc:
            logger.warning(
                "Event publishing failed for event_type=%s instance_id=%s: %s",
                event_type,
                strategy_instance_id,
                exc,
            )

    async def _async_publish(self, topic: str, event: Event) -> None:
        try:
            if self._event_publisher:
                await self._event_publisher.publish(topic, event)
        except Exception as exc:
            logger.warning(
                "Async event publish error on topic=%s event_type=%s: %s",
                topic,
                event.event_type,
                exc,
            )

    def start_instance(self, instance_id: UUID, user_id: UUID) -> StrategyInstance:
        """Starts a strategy instance (READY/DRAFT -> RUNNING) and publishes instance.started event."""
        instance = self._repository.get_instance_for_user(instance_id, user_id)
        if not instance:
            raise ValueError(f"Strategy instance {instance_id} not found for user {user_id}")

        current_status = instance.status.upper()
        if current_status == "DRAFT":
            instance = self._repository.update_instance_status(instance_id, user_id, "READY")

        updated_instance = self._repository.update_instance_status(instance_id, user_id, "RUNNING")
        self._publish_event(
            EventType.INSTANCE_STARTED,
            user_id=user_id,
            strategy_instance_id=instance_id,
            strategy_id=updated_instance.strategy_definition_id,
            broker_id=updated_instance.broker_id,
            execution_mode=updated_instance.execution_mode,
            payload={"status": "RUNNING", "previous_status": current_status},
        )
        return updated_instance

    def pause_instance(self, instance_id: UUID, user_id: UUID) -> StrategyInstance:
        """Pauses a running strategy instance (RUNNING -> PAUSED) and publishes instance.paused event."""
        instance = self._repository.get_instance_for_user(instance_id, user_id)
        if not instance:
            raise ValueError(f"Strategy instance {instance_id} not found for user {user_id}")

        current_status = instance.status.upper()
        updated_instance = self._repository.update_instance_status(instance_id, user_id, "PAUSED")
        self._publish_event(
            EventType.INSTANCE_PAUSED,
            user_id=user_id,
            strategy_instance_id=instance_id,
            strategy_id=updated_instance.strategy_definition_id,
            broker_id=updated_instance.broker_id,
            execution_mode=updated_instance.execution_mode,
            payload={"status": "PAUSED", "previous_status": current_status},
        )
        return updated_instance

    def resume_instance(self, instance_id: UUID, user_id: UUID) -> StrategyInstance:
        """Resumes a paused strategy instance (PAUSED -> RUNNING) and publishes instance.resumed event."""
        instance = self._repository.get_instance_for_user(instance_id, user_id)
        if not instance:
            raise ValueError(f"Strategy instance {instance_id} not found for user {user_id}")

        current_status = instance.status.upper()
        updated_instance = self._repository.update_instance_status(instance_id, user_id, "RUNNING")
        self._publish_event(
            EventType.INSTANCE_RESUMED,
            user_id=user_id,
            strategy_instance_id=instance_id,
            strategy_id=updated_instance.strategy_definition_id,
            broker_id=updated_instance.broker_id,
            execution_mode=updated_instance.execution_mode,
            payload={"status": "RUNNING", "previous_status": current_status},
        )
        return updated_instance

    def stop_instance(self, instance_id: UUID, user_id: UUID) -> StrategyInstance:
        """Stops a strategy instance (* -> STOPPED) and publishes instance.stopped event."""
        instance = self._repository.get_instance_for_user(instance_id, user_id)
        if not instance:
            raise ValueError(f"Strategy instance {instance_id} not found for user {user_id}")

        current_status = instance.status.upper()
        updated_instance = self._repository.update_instance_status(instance_id, user_id, "STOPPED")
        self._publish_event(
            EventType.INSTANCE_STOPPED,
            user_id=user_id,
            strategy_instance_id=instance_id,
            strategy_id=updated_instance.strategy_definition_id,
            broker_id=updated_instance.broker_id,
            execution_mode=updated_instance.execution_mode,
            payload={"status": "STOPPED", "previous_status": current_status},
        )
        return updated_instance

    def mark_instance_failed(
        self, instance_id: UUID, user_id: UUID, error_message: str
    ) -> StrategyInstance:
        """Marks a strategy instance as FAILED and publishes instance.failed event."""
        instance = self._repository.get_instance_for_user(instance_id, user_id)
        if not instance:
            raise ValueError(f"Strategy instance {instance_id} not found for user {user_id}")

        current_status = instance.status.upper()
        updated_instance = self._repository.update_instance_status(instance_id, user_id, "FAILED")
        updated_instance.error_message = error_message
        self._repository.db.commit()

        self._publish_event(
            EventType.INSTANCE_FAILED,
            user_id=user_id,
            strategy_instance_id=instance_id,
            strategy_id=updated_instance.strategy_definition_id,
            broker_id=updated_instance.broker_id,
            execution_mode=updated_instance.execution_mode,
            payload={
                "status": "FAILED",
                "previous_status": current_status,
                "error_message": error_message,
            },
        )
        return updated_instance

    def _validate_market_data_timestamp(self, market_data: Dict[str, Any]) -> datetime:
        """Validates market data timestamp staleness (Fail-Closed)."""
        raw_ts = market_data.get("timestamp") or market_data.get("generatedAt") or market_data.get("time")
        if not raw_ts:
            raise StaleDataException("Market data is missing a valid timestamp (Fail-Closed).")

        try:
            if isinstance(raw_ts, (int, float)):
                ts_dt = datetime.fromtimestamp(raw_ts, tz=timezone.utc)
            elif isinstance(raw_ts, str):
                ts_dt = datetime.fromisoformat(raw_ts.replace("Z", "+00:00"))
            else:
                ts_dt = raw_ts
        except Exception as e:
            raise StaleDataException(f"Invalid market data timestamp format: {e}")

        now = datetime.now(timezone.utc)
        age = (now - ts_dt).total_seconds()
        if age > self.max_data_age_seconds:
            raise StaleDataException(
                f"Market data is stale ({age:.1f}s old, max allowed {self.max_data_age_seconds}s)."
            )

        return ts_dt

    def compute_signal_fingerprint(
        self,
        instance_id: UUID,
        symbol: str,
        side: str,
        quantity: Decimal,
        event_ts: datetime,
    ) -> str:
        """Computes a canonical SHA-256 fingerprint for signal deduplication."""
        payload = f"{instance_id}:{symbol.upper()}:{side.upper()}:{quantity}:{event_ts.isoformat()}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def execute_cycle(
        self,
        instance_id: UUID,
        user_id: UUID,
        market_data: Dict[str, Any],
        strategy: Optional[BaseStrategy] = None,
    ) -> Optional[BrokerOrder]:
        """
        Executes a single strategy cycle for an instance:
        1. Validates instance ownership & RUNNING status.
        2. Enforces Stale Data Guard on market data timestamp.
        3. Evaluates strategy logic to generate proposed signal.
        4. Computes signal fingerprint & enforces Signal Deduplication Guard.
        5. Converts signal to BrokerOrderRequest & deterministic idempotency key.
        6. Enforces Paper/Live isolation:
           - PAPER mode -> Executes paper simulation (returns simulated BrokerOrder).
           - LIVE mode -> Calls BrokerOrderService (which enforces RiskEngine & Idempotency).
        7. Publishes real-time events for signal generation, execution, or rejection.
        """
        instance = self._repository.get_instance_for_user(instance_id, user_id)
        if not instance:
            raise ValueError(f"Strategy instance {instance_id} not found for user {user_id}")

        if instance.status.upper() != "RUNNING":
            logger.info(f"Strategy instance {instance_id} is not RUNNING (status: {instance.status}). Skipping cycle.")
            return None

        # 1. Stale Data Guard
        event_ts = self._validate_market_data_timestamp(market_data)

        # 2. Execute Strategy Logic
        strat_impl = strategy or DeterministicMomentumStrategy()
        signal_dict = strat_impl.generate_signal(market_data)
        if not signal_dict:
            logger.debug(f"Strategy {instance_id} generated no signal for {market_data.get('symbol')}.")
            return None

        symbol = str(signal_dict["symbol"]).upper()
        side = str(signal_dict["side"]).upper()
        quantity = Decimal(str(signal_dict["quantity"]))
        order_type = str(signal_dict.get("order_type", "MARKET")).upper()
        price = Decimal(str(signal_dict["price"])) if signal_dict.get("price") is not None else None

        # 3. Compute Fingerprint & Enforce Signal Deduplication Guard
        fingerprint = self.compute_signal_fingerprint(instance_id, symbol, side, quantity, event_ts)
        signal_record, is_new = self._repository.create_signal_if_not_exists(
            strategy_instance_id=instance_id,
            user_id=user_id,
            broker_id=instance.broker_id,
            symbol=symbol,
            side=side,
            quantity=quantity,
            order_type=order_type,
            price=price,
            signal_fingerprint=fingerprint,
        )

        if not is_new:
            logger.warning(f"Duplicate signal detected for strategy instance {instance_id} with fingerprint {fingerprint}.")
            raise DuplicateSignalException("Signal has already been processed for this strategy instance.")

        # Publish signal.generated event
        self._publish_event(
            EventType.SIGNAL_GENERATED,
            user_id=user_id,
            strategy_instance_id=instance_id,
            strategy_id=instance.strategy_definition_id,
            broker_id=instance.broker_id,
            symbol=symbol,
            execution_mode=instance.execution_mode,
            payload={
                "signal_id": str(signal_record.id),
                "side": side,
                "quantity": str(quantity),
                "order_type": order_type,
                "price": str(price) if price is not None else None,
                "signal_fingerprint": fingerprint,
            },
        )

        # 4. Construct Order Request & Deterministic Idempotency Key
        order_request = BrokerOrderRequest(
            symbol=symbol,
            exchange="NSE",
            quantity=quantity,
            side=side,
            order_type=order_type,
            product="CNC",
            variety="regular",
            price=price,
        )
        idempotency_key = f"STRAT-{instance_id}-{signal_record.id}"

        # 5. Paper vs Live Mode Execution Routing
        if instance.execution_mode.upper() == "PAPER":
            logger.info(f"Executing strategy signal in PAPER mode for instance {instance_id}.")
            paper_order = BrokerOrder(
                order_id=f"PAPER-{signal_record.id.hex[:12]}",
                symbol=symbol,
                side=side,
                quantity=quantity,
                status="COMPLETE",
            )
            fill_price = price if price is not None else Decimal("0.0000")

            if self._paper_accounting_service:
                try:
                    self._paper_accounting_service.record_fill(
                        user_id=user_id,
                        strategy_instance_id=instance_id,
                        symbol=symbol,
                        side=side,
                        quantity=quantity,
                        price=fill_price,
                        execution_mode="PAPER",
                        execution_id=paper_order.order_id,
                    )
                except Exception as exc:
                    signal_record.status = "REJECTED"
                    self._repository.db.commit()

                    self._publish_event(
                        EventType.SIGNAL_REJECTED,
                        user_id=user_id,
                        strategy_instance_id=instance_id,
                        strategy_id=instance.strategy_definition_id,
                        broker_id=instance.broker_id,
                        symbol=symbol,
                        execution_mode="PAPER",
                        payload={
                            "signal_id": str(signal_record.id),
                            "reason": str(exc),
                            "side": side,
                            "quantity": str(quantity),
                        },
                    )
                    logger.warning(f"Paper signal execution rejected for instance {instance_id}: {exc}")
                    return None

            signal_record.status = "EXECUTED"
            self._repository.db.commit()

            # Publish signal.executed event
            self._publish_event(
                EventType.SIGNAL_EXECUTED,
                user_id=user_id,
                strategy_instance_id=instance_id,
                strategy_id=instance.strategy_definition_id,
                broker_id=instance.broker_id,
                symbol=symbol,
                execution_mode="PAPER",
                payload={
                    "signal_id": str(signal_record.id),
                    "order_id": paper_order.order_id,
                    "status": "COMPLETE",
                    "side": side,
                    "quantity": str(quantity),
                    "price": str(fill_price),
                },
            )

            return paper_order

        elif instance.execution_mode.upper() == "LIVE":
            if not self._broker_order_service:
                raise BaseStrategyException("BrokerOrderService is required for LIVE strategy execution.")

            logger.info(f"Executing strategy signal in LIVE mode for instance {instance_id} via RiskEngine & BrokerOrderService.")
            try:
                order = self._broker_order_service.place_order(
                    user_id=user_id,
                    broker_id=instance.broker_id,
                    request=order_request,
                    idempotency_key=idempotency_key,
                )
                signal_record.status = "EXECUTED"
                self._repository.db.commit()

                # Publish signal.executed event
                self._publish_event(
                    EventType.SIGNAL_EXECUTED,
                    user_id=user_id,
                    strategy_instance_id=instance_id,
                    strategy_id=instance.strategy_definition_id,
                    broker_id=instance.broker_id,
                    symbol=symbol,
                    execution_mode="LIVE",
                    payload={
                        "signal_id": str(signal_record.id),
                        "order_id": order.order_id,
                        "status": order.status,
                        "side": side,
                        "quantity": str(quantity),
                    },
                )
                return order
            except Exception as e:
                signal_record.status = "REJECTED"
                self._repository.db.commit()

                # Publish signal.rejected event
                self._publish_event(
                    EventType.SIGNAL_REJECTED,
                    user_id=user_id,
                    strategy_instance_id=instance_id,
                    strategy_id=instance.strategy_definition_id,
                    broker_id=instance.broker_id,
                    symbol=symbol,
                    execution_mode="LIVE",
                    payload={
                        "signal_id": str(signal_record.id),
                        "reason": str(e),
                        "side": side,
                        "quantity": str(quantity),
                    },
                )
                raise e

        else:
            raise BaseStrategyException(f"Unsupported strategy execution mode: {instance.execution_mode}")
