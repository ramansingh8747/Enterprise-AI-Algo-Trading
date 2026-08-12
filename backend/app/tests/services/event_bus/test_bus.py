import pytest
import asyncio
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from pydantic import ConfigDict
from app.services.event_bus.models import Event, EventType
from app.services.event_bus.bus import EventBus
from app.services.event_bus.topics import Topic

def test_event_model():
    data = {
        "event_id": uuid.uuid4(),
        "event_type": EventType.STRATEGY_CREATED,
        "timestamp": datetime.now(timezone.utc),
        "user_id": uuid.uuid4(),
        "payload": {"name": "Test"}
    }
    event = Event(**data)
    assert event.event_id == data["event_id"]
    assert event.payload["name"] == "Test"

def test_subscribe_publish():
    async def run():
        bus = EventBus()
        topic = Topic.market("AAPL")
        subscriber = await bus.subscribe(topic)
        
        event = Event(
            event_id=uuid.uuid4(),
            event_type=EventType.QUOTE_UPDATED,
            timestamp=datetime.now(timezone.utc),
            user_id=uuid.uuid4(),
            payload={"price": Decimal("150.00")}
        )
        
        await bus.publish(topic, event)
        received = await subscriber.consume()
        assert received.event_id == event.event_id
        await subscriber.close()
    
    asyncio.run(run())

def test_subscriber_isolation():
    async def run():
        bus = EventBus()
        topic_a = "topic:a"
        topic_b = "topic:b"
        
        sub_a = await bus.subscribe(topic_a)
        sub_b = await bus.subscribe(topic_b)
        
        event = Event(
            event_id=uuid.uuid4(),
            event_type=EventType.QUOTE_UPDATED,
            timestamp=datetime.now(timezone.utc),
            user_id=uuid.uuid4(),
            payload={}
        )
        
        await bus.publish(topic_a, event)
        
        received_a = await sub_a.consume()
        assert received_a.event_id == event.event_id
        
        with pytest.raises(asyncio.TimeoutError):
            await asyncio.wait_for(sub_b.consume(), timeout=0.1)
        
        await sub_a.close()
        await sub_b.close()
    
    asyncio.run(run())

def test_backpressure():
    async def run():
        bus = EventBus(max_queue_size=1)
        topic = "topic:a"
        subscriber = await bus.subscribe(topic)
        
        event1 = Event(event_id=uuid.uuid4(), event_type=EventType.QUOTE_UPDATED, timestamp=datetime.now(timezone.utc), user_id=uuid.uuid4())
        event2 = Event(event_id=uuid.uuid4(), event_type=EventType.QUOTE_UPDATED, timestamp=datetime.now(timezone.utc), user_id=uuid.uuid4())
        
        await bus.publish(topic, event1)
        with pytest.raises(Exception, match="Queue full"):
            await bus.publish(topic, event2)
        
        await subscriber.close()
    
    asyncio.run(run())
