import asyncio
from app.services.continuous_portfolio_valuation_service import ContinuousPortfolioValuationService
from app.services.event_bus.models import EventType
from app.services.event_bus.topics import Topic

class FakeSubscriber:
    def __init__(self): self.queue = asyncio.Queue()
    async def consume(self): return await self.queue.get()
    async def close(self): pass

class FakeBus:
    def __init__(self): self.subscribers = {}
    async def subscribe(self, topic):
        sub = FakeSubscriber(); self.subscribers[topic] = sub; return sub

def test_refreshes_quote_topics_for_held_symbols():
    bus = FakeBus(); service = ContinuousPortfolioValuationService(bus, lambda db: None)
    service._symbols = lambda: {"INFY", "TCS"}
    async def run():
        await service._refresh_subscriptions()
        assert set(bus.subscribers) == {Topic.market("INFY"), Topic.market("TCS")}
        await service.stop()
    asyncio.run(run())

def test_only_quote_updated_is_accepted():
    assert EventType.QUOTE_UPDATED.value == "quote.updated"
