# Event Bus Implementation

## Overview
This document describes the in-memory Event Bus implementation.

## Event Model
- `Event`: Pydantic model for events.
- `EventType`: Enum defining supported event types.

## Publisher/Subscriber
- `EventPublisher`: Protocol defining `publish(topic, event)`.
- `EventSubscriber`: Protocol defining `consume()` and `close()`.

## EventBus
- `In-MemoryEventBus`: Uses `asyncio.Queue` per subscriber to decouple producers and consumers.

## Backpressure
- `max_queue_size` defines the buffer for each subscriber.
- `put_nowait` is used to prevent the publisher from blocking, raising an exception if the subscriber queue is full.

## Future Redis Migration
- The `EventPublisher` and `EventSubscriber` interfaces are designed to be replaced by a Redis-based implementation without changing the publisher or subscriber logic.
