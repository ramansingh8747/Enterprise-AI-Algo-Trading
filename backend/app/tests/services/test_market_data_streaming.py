"""
Focused tests for Real-Time Market Data Streaming & EventBus Integration (Step 13.21I.34.119).

Tests:
  1. quote.updated event generation
  2. market:<symbol> topic routing
  3. symbol normalization (lowercase/whitespace -> uppercase)
  4. Decimal string preservation (prices remain strings)
  5. malformed quote rejection (missing symbol or price)
  6. stale quote handling (quote.stale emitted when age > max_quote_age)
  7. provider failure isolation (EventBus publish error doesn't break provider)
  8. multiple subscribers on same market:<symbol> topic
  9. user isolation in event envelope
  10. credential isolation in event payload (zero secrets exposed)
  11. EventBus integration
  12. ConnectionManager integration for market topics
"""

import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Tuple
import pytest

from app.services.event_bus.bus import EventBus
from app.services.event_bus.connection_manager import WebSocketConnectionManager
from app.services.event_bus.models import Event, EventType
from app.services.event_bus.topics import Topic
from app.services.market_data.market_data_provider import MarketDataProvider


class CapturingEventPublisher:
    def __init__(self, fail_mode: bool = False):
        self.published_events: List[Tuple[str, Event]] = []
        self.fail_mode = fail_mode

    async def publish(self, topic: str, event: Event) -> None:
        if self.fail_mode:
            raise RuntimeError("EventBus connection failure simulation!")
        self.published_events.append((topic, event))


@pytest.mark.asyncio
async def test_quote_updated_event_generation():
    publisher = CapturingEventPublisher()
    provider = MarketDataProvider(event_publisher=publisher)

    user_id = uuid.uuid4()
    now_iso = datetime.now(timezone.utc).isoformat()
    raw_quote = {
        "symbol": "reliance",
        "last_price": "2500.50",
        "bid": "2500.25",
        "ask": "2500.75",
        "change": "12.50",
        "change_percent": "0.50",
        "volume": 100000,
        "timestamp": now_iso,
    }

    event = provider.process_and_publish_quote(user_id=user_id, raw_quote=raw_quote)
    await asyncio.sleep(0.01)

    assert event is not None
    assert event.event_type == EventType.QUOTE_UPDATED
    assert len(publisher.published_events) == 1

    topic, pub_event = publisher.published_events[0]
    assert topic == "market:RELIANCE"
    assert pub_event.symbol == "RELIANCE"
    assert pub_event.user_id == user_id


@pytest.mark.asyncio
async def test_symbol_normalization():
    publisher = CapturingEventPublisher()
    provider = MarketDataProvider(event_publisher=publisher)

    user_id = uuid.uuid4()
    now_iso = datetime.now(timezone.utc).isoformat()
    raw_quote = {
        "tradingsymbol": "  tcs  ",
        "price": 3500.0,
        "timestamp": now_iso,
    }

    event = provider.process_and_publish_quote(user_id=user_id, raw_quote=raw_quote)
    await asyncio.sleep(0.01)

    assert event is not None
    assert event.symbol == "TCS"
    assert publisher.published_events[0][0] == "market:TCS"


@pytest.mark.asyncio
async def test_decimal_string_preservation():
    publisher = CapturingEventPublisher()
    provider = MarketDataProvider(event_publisher=publisher)

    user_id = uuid.uuid4()
    now_iso = datetime.now(timezone.utc).isoformat()
    raw_quote = {
        "symbol": "INFY",
        "last_price": 1450.75,
        "bid": 1450.50,
        "ask": 1451.00,
        "timestamp": now_iso,
    }

    event = provider.process_and_publish_quote(user_id=user_id, raw_quote=raw_quote)
    await asyncio.sleep(0.01)

    assert event is not None
    payload = event.payload
    assert isinstance(payload["last_price"], str)
    assert payload["last_price"] == "1450.75"
    assert isinstance(payload["bid"], str)
    assert payload["bid"] == "1450.5"
    assert isinstance(payload["ask"], str)
    assert payload["ask"] == "1451.0"


@pytest.mark.asyncio
async def test_malformed_quote_rejection():
    publisher = CapturingEventPublisher()
    provider = MarketDataProvider(event_publisher=publisher)

    user_id = uuid.uuid4()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Missing symbol
    event1 = provider.process_and_publish_quote(
        user_id=user_id, raw_quote={"price": 100, "timestamp": now_iso}
    )
    assert event1 is None

    # Invalid non-numeric price
    event2 = provider.process_and_publish_quote(
        user_id=user_id, raw_quote={"symbol": "SBIN", "price": "INVALID", "timestamp": now_iso}
    )
    assert event2 is None

    assert len(publisher.published_events) == 0


@pytest.mark.asyncio
async def test_stale_quote_handling():
    publisher = CapturingEventPublisher()
    provider = MarketDataProvider(event_publisher=publisher, max_quote_age_seconds=5)

    user_id = uuid.uuid4()
    old_time = (datetime.now(timezone.utc) - timedelta(seconds=20)).isoformat()

    raw_quote = {
        "symbol": "WIPRO",
        "price": "400.00",
        "timestamp": old_time,
    }

    event = provider.process_and_publish_quote(user_id=user_id, raw_quote=raw_quote)
    await asyncio.sleep(0.01)

    assert event is not None
    assert event.event_type == EventType.QUOTE_STALE
    assert event.payload["is_stale"] is True
    assert "Stale quote" in event.payload["reason"]
    assert publisher.published_events[0][0] == "market:WIPRO"


@pytest.mark.asyncio
async def test_provider_failure_isolation():
    failing_publisher = CapturingEventPublisher(fail_mode=True)
    provider = MarketDataProvider(event_publisher=failing_publisher)

    user_id = uuid.uuid4()
    now_iso = datetime.now(timezone.utc).isoformat()
    raw_quote = {
        "symbol": "HDFCBANK",
        "price": "1600.00",
        "timestamp": now_iso,
    }

    # Should not raise RuntimeError despite failing publisher
    event = provider.process_and_publish_quote(user_id=user_id, raw_quote=raw_quote)
    await asyncio.sleep(0.01)
    assert event is not None


@pytest.mark.asyncio
async def test_multiple_subscribers_on_market_topic():
    bus = EventBus()
    sub1 = await bus.subscribe("market:TATAMOTORS")
    sub2 = await bus.subscribe("market:TATAMOTORS")

    provider = MarketDataProvider(event_publisher=bus)
    user_id = uuid.uuid4()
    now_iso = datetime.now(timezone.utc).isoformat()
    raw_quote = {
        "symbol": "TATAMOTORS",
        "price": "900.00",
        "timestamp": now_iso,
    }

    provider.process_and_publish_quote(user_id=user_id, raw_quote=raw_quote)

    ev1 = await sub1.consume()
    ev2 = await sub2.consume()

    assert ev1.symbol == "TATAMOTORS"
    assert ev2.symbol == "TATAMOTORS"
    assert ev1.payload["last_price"] == "900.00"

    await sub1.close()
    await sub2.close()


@pytest.mark.asyncio
async def test_user_isolation_in_event_envelope():
    publisher = CapturingEventPublisher()
    provider = MarketDataProvider(event_publisher=publisher)

    user_a = uuid.uuid4()
    user_b = uuid.uuid4()
    now_iso = datetime.now(timezone.utc).isoformat()

    provider.process_and_publish_quote(user_id=user_a, raw_quote={"symbol": "AXISBANK", "price": "1000", "timestamp": now_iso})
    provider.process_and_publish_quote(user_id=user_b, raw_quote={"symbol": "AXISBANK", "price": "1000", "timestamp": now_iso})
    await asyncio.sleep(0.01)

    assert len(publisher.published_events) == 2
    assert publisher.published_events[0][1].user_id == user_a
    assert publisher.published_events[1][1].user_id == user_b


@pytest.mark.asyncio
async def test_credential_isolation_in_market_events():
    publisher = CapturingEventPublisher()
    provider = MarketDataProvider(event_publisher=publisher)

    user_id = uuid.uuid4()
    now_iso = datetime.now(timezone.utc).isoformat()
    raw_quote = {
        "symbol": "ITC",
        "price": "450.00",
        "timestamp": now_iso,
        "api_key": "secret_key_123",
        "access_token": "secret_token_456",
    }

    event = provider.process_and_publish_quote(user_id=user_id, raw_quote=raw_quote)
    await asyncio.sleep(0.01)

    assert event is not None
    event_json = event.model_dump_json().lower()

    for forbidden in ["api_key", "api_secret", "access_token", "password", "jwt", "authorization"]:
        assert forbidden not in event_json, f"Secret key '{forbidden}' leaked into market quote event!"


@pytest.mark.asyncio
async def test_event_bus_and_connection_manager_integration():
    bus = EventBus()
    manager = WebSocketConnectionManager(bus)
    provider = MarketDataProvider(event_publisher=bus)

    user_id = uuid.uuid4()
    now_iso = datetime.now(timezone.utc).isoformat()

    sub = await bus.subscribe("market:NIFTY")
    provider.process_and_publish_quote(user_id=user_id, raw_quote={"symbol": "NIFTY", "price": "22000.00", "timestamp": now_iso})

    received_event = await sub.consume()
    assert received_event.event_type == EventType.QUOTE_UPDATED
    assert received_event.symbol == "NIFTY"
    assert received_event.payload["last_price"] == "22000.00"

    await sub.close()
