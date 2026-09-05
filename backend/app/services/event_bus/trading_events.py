import asyncio
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID, uuid4

from app.services.event_bus.models import Event, EventType
from app.services.event_bus.topics import Topic

logger = logging.getLogger(__name__)


class TradingEventPublisher:
    """Publishes application-owned trading lifecycle events to the EventBus.

    The publisher is intentionally non-blocking for synchronous trading services.
    Database state is committed by the caller before events are emitted.
    """

    def __init__(self, event_bus: Any):
        self._event_bus = event_bus

    @staticmethod
    def _safe(value: Any) -> Any:
        if isinstance(value, Decimal):
            return str(value)
        if isinstance(value, UUID):
            return str(value)
        if isinstance(value, datetime):
            return value.isoformat()
        return value

    def emit(
        self,
        event_type: EventType,
        *,
        user_id: UUID,
        broker_id: Optional[UUID] = None,
        strategy_id: Optional[UUID] = None,
        strategy_instance_id: Optional[UUID] = None,
        symbol: Optional[str] = None,
        execution_mode: Optional[str] = None,
        payload: Optional[dict[str, Any]] = None,
    ) -> Event:
        event = Event(
            event_id=uuid4(),
            event_type=event_type,
            timestamp=datetime.now(timezone.utc),
            user_id=user_id,
            broker_id=broker_id,
            strategy_id=strategy_id,
            strategy_instance_id=strategy_instance_id,
            symbol=symbol.upper() if symbol else None,
            execution_mode=execution_mode,
            payload={k: self._safe(v) for k, v in (payload or {}).items()},
        )
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self._publish(event))
        except RuntimeError:
            logger.debug("No running event loop; trading event %s was not dispatched", event.event_id)
        return event

    async def _publish(self, event: Event) -> None:
        try:
            # Admin stream is deliberately centralized so the Admin Monitor receives
            # the same canonical Event envelope as other websocket consumers.
            await self._event_bus.publish(Topic.admin_events(), event)
        except Exception:
            logger.exception("Failed to publish trading event %s", event.event_id)
