"""
Redis Pub/Sub Multi-Worker Event Transport Adapter (Step 13.21I.34.122).

Enables cross-worker market quote event broadcasting using Redis Pub/Sub channels.
Transports canonical Event envelopes across application instances without event loops,
preserving string-safe Decimal financial precision and strict credential isolation.
"""

import asyncio
import json
import logging
from typing import Any, Dict, Optional
from uuid import UUID

from app.services.event_bus.models import Event, EventType

logger = logging.getLogger(__name__)


class RedisEventTransport:
    """
    Adapter for broadcasting EventBus events across multiple application workers via Redis Pub/Sub.
    """

    def __init__(
        self,
        event_bus: Any,
        channel: str = "trading:events",
        redis_client: Optional[Any] = None,
        enabled: bool = True,
    ) -> None:
        self.event_bus = event_bus
        self.channel = channel
        self.enabled = enabled
        self._client = redis_client
        self._pubsub: Optional[Any] = None
        self._listen_task: Optional[asyncio.Task] = None
        self._is_connected: bool = False

    @property
    def is_connected(self) -> bool:
        return self._is_connected

    async def connect(self) -> bool:
        """
        Initializes connection to Redis Pub/Sub channel.
        FAIL-SAFE: If Redis is unavailable or unconfigured, logs warning and returns False
        without raising exceptions or crashing caller.
        """
        if not self.enabled:
            logger.info("Redis Pub/Sub transport is disabled in configuration.")
            return False

        try:
            if self._client is None:
                import redis.asyncio as aioredis
                self._client = aioredis.from_url("redis://localhost:6379", decode_responses=True)

            # Test connection if client supports ping
            if hasattr(self._client, "ping"):
                await self._client.ping()

            self._is_connected = True
            logger.info("Redis Pub/Sub transport connected to channel '%s'", self.channel)
            return True
        except Exception as exc:
            self._is_connected = False
            logger.warning("Redis Pub/Sub connection unavailable: %s. Operating in local mode.", exc)
            return False

    async def publish(self, topic: str, event: Event) -> bool:
        """
        Serializes and publishes local Event to Redis Pub/Sub channel.
        Preserves string-safe Decimal quantities and event_id.
        FAIL-SAFE: Returns False on error without raising exceptions.
        """
        if not self.enabled or not self._is_connected or self._client is None:
            return False

        try:
            # Serialize envelope safely
            event_dict = event.model_dump(mode="json")
            payload_data = {
                "topic": topic,
                "event": event_dict,
                "origin_worker_id": str(event.event_id),
            }

            serialized = json.dumps(payload_data)

            if hasattr(self._client, "publish"):
                res = self._client.publish(self.channel, serialized)
                if asyncio.iscoroutine(res):
                    await res

            return True
        except Exception as exc:
            logger.warning("Redis Pub/Sub publish failed for topic %s: %s", topic, exc)
            return False

    async def start_listening(self) -> None:
        """Starts background listener task for Redis Pub/Sub channel."""
        if not self.enabled or not self._is_connected or self._client is None:
            return

        try:
            if hasattr(self._client, "pubsub"):
                self._pubsub = self._client.pubsub()
                await self._pubsub.subscribe(self.channel)
                self._listen_task = asyncio.create_task(self._listen_loop())
                logger.info("Redis Pub/Sub listener started on channel '%s'", self.channel)
        except Exception as exc:
            logger.warning("Failed to start Redis Pub/Sub listener: %s", exc)

    async def _listen_loop(self) -> None:
        """Background loop reading messages from Redis Pub/Sub."""
        if not self._pubsub:
            return

        try:
            while self._is_connected and self._listen_task and not self._listen_task.cancelled():
                msg = await self._pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if msg and msg.get("type") == "message":
                    raw_data = msg.get("data")
                    self.process_incoming_message(raw_data)
                await asyncio.sleep(0.01)
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.warning("Redis Pub/Sub listen loop error: %s", exc)

    def process_incoming_message(self, raw_data: Any) -> Optional[Event]:
        """
        Deserializes raw JSON message from Redis, converts it to Event instance,
        and dispatches it to local EventBus with `from_redis=True` flag (preventing event loops).
        """
        if not raw_data:
            return None

        try:
            if isinstance(raw_data, bytes):
                raw_data = raw_data.decode("utf-8")

            parsed = json.loads(raw_data) if isinstance(raw_data, str) else raw_data
            if not isinstance(parsed, dict):
                return None

            topic = parsed.get("topic")
            event_data = parsed.get("event")
            if not topic or not isinstance(event_data, dict):
                return None

            event = Event.model_validate(event_data)

            # Dispatch to local EventBus subscribers with from_redis=True to prevent event loop
            if self.event_bus and hasattr(self.event_bus, "publish"):
                try:
                    loop = asyncio.get_running_loop()
                    loop.create_task(self.event_bus.publish(topic, event, from_redis=True))
                except RuntimeError:
                    asyncio.run(self.event_bus.publish(topic, event, from_redis=True))

            return event
        except Exception as exc:
            logger.warning("Error processing incoming Redis message: %s", exc)
            return None

    async def close(self) -> None:
        """Clean shutdown of Redis Pub/Sub connection and listener task."""
        self._is_connected = False
        if self._listen_task:
            self._listen_task.cancel()
            try:
                await self._listen_task
            except (asyncio.CancelledError, Exception):
                pass
            self._listen_task = None

        if self._pubsub:
            try:
                await self._pubsub.unsubscribe(self.channel)
                await self._pubsub.close()
            except Exception:
                pass
            self._pubsub = None

        if self._client and hasattr(self._client, "close"):
            try:
                res = self._client.close()
                if asyncio.iscoroutine(res):
                    await res
            except Exception:
                pass

        logger.info("Redis Pub/Sub transport shut down cleanly.")
