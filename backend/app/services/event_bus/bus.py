import asyncio
import logging
from typing import Dict, Optional, Set, Any
from .models import Event
from .interfaces import EventPublisher, EventSubscriber

logger = logging.getLogger(__name__)


class Subscriber(EventSubscriber):
    def __init__(self, topic: str, queue: asyncio.Queue, bus: 'EventBus'):
        self.topic = topic
        self.queue = queue
        self.bus = bus
        self._closed = False

    async def consume(self) -> Event:
        if self._closed:
            raise Exception("Subscriber is closed")
        return await self.queue.get()

    async def close(self) -> None:
        if not self._closed:
            self._closed = True
            await self.bus.unsubscribe(self.topic, self)


class EventBus(EventPublisher):
    def __init__(self, max_queue_size: int = 100, redis_transport: Optional[Any] = None):
        self._subscribers: Dict[str, Set[Subscriber]] = {}
        self._max_queue_size = max_queue_size
        self._lock = asyncio.Lock()
        self._running = True
        self._redis_transport = redis_transport

    def set_redis_transport(self, redis_transport: Any) -> None:
        """Attaches a RedisEventTransport instance to enabling multi-worker broadcasting."""
        self._redis_transport = redis_transport

    async def subscribe(self, topic: str) -> EventSubscriber:
        async with self._lock:
            if not self._running:
                raise Exception("Bus is closed")
            queue = asyncio.Queue(maxsize=self._max_queue_size)
            subscriber = Subscriber(topic, queue, self)
            if topic not in self._subscribers:
                self._subscribers[topic] = set()
            self._subscribers[topic].add(subscriber)
            return subscriber

    async def unsubscribe(self, topic: str, subscriber: EventSubscriber) -> None:
        async with self._lock:
            if topic in self._subscribers:
                self._subscribers[topic].discard(subscriber)
                if not self._subscribers[topic]:
                    del self._subscribers[topic]

    async def publish(self, topic: str, event: Event, from_redis: bool = False) -> None:
        """
        Publishes event to local subscribers and optionally to Redis Pub/Sub for cross-worker broadcast.
        from_redis=True prevents infinite event loops by NOT re-publishing Redis-origin events.
        """
        async with self._lock:
            if not self._running:
                return

            # 1. Dispatch to local subscribers
            if topic in self._subscribers:
                for sub in self._subscribers[topic]:
                    try:
                        sub.queue.put_nowait(event)
                    except asyncio.QueueFull:
                        logger.error(f"Subscriber queue full for topic {topic}. Dropping event {event.event_id}")
                        raise Exception(f"Queue full for topic {topic}")

            # 2. Forward to Redis Pub/Sub if local-origin and transport active
            if not from_redis and self._redis_transport and getattr(self._redis_transport, "is_connected", False):
                try:
                    try:
                        loop = asyncio.get_running_loop()
                        loop.create_task(self._redis_transport.publish(topic, event))
                    except RuntimeError:
                        asyncio.run(self._redis_transport.publish(topic, event))
                except Exception as exc:
                    logger.warning(f"Failed to publish event {event.event_id} to Redis transport: {exc}")

    async def shutdown(self) -> None:
        async with self._lock:
            self._running = False
            for topic, subscribers in self._subscribers.items():
                for sub in list(subscribers):
                    await sub.close()
            self._subscribers.clear()

            if self._redis_transport and hasattr(self._redis_transport, "close"):
                try:
                    res = self._redis_transport.close()
                    if asyncio.iscoroutine(res):
                        await res
                except Exception as exc:
                    logger.warning(f"Error closing Redis transport during EventBus shutdown: {exc}")
