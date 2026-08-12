from typing import Protocol, runtime_checkable
from .models import Event

@runtime_checkable
class EventPublisher(Protocol):
    async def publish(self, topic: str, event: Event) -> None:
        ...

@runtime_checkable
class EventSubscriber(Protocol):
    async def consume(self) -> Event:
        ...

    async def close(self) -> None:
        ...
