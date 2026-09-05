import asyncio
from uuid import uuid4
from app.services.event_bus.bus import EventBus
from app.services.event_bus.trading_events import TradingEventPublisher
from app.services.event_bus.models import EventType
from app.services.event_bus.topics import Topic


def test_trading_event_publisher_dispatches_admin_event():
    async def run():
        bus = EventBus()
        subscriber = await bus.subscribe(Topic.admin_events())
        publisher = TradingEventPublisher(bus)
        user_id = uuid4()
        event = publisher.emit(
            EventType.ORDER_CREATED,
            user_id=user_id,
            broker_id=uuid4(),
            symbol="INFY",
            execution_mode="LIVE",
            payload={"quantity": "2", "price": "100.25"},
        )
        received = await asyncio.wait_for(subscriber.consume(), timeout=1)
        assert received.event_id == event.event_id
        assert received.event_type == EventType.ORDER_CREATED
        assert received.payload["quantity"] == "2"
        await subscriber.close()
        await bus.shutdown()

    asyncio.run(run())
