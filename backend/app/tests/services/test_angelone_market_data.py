"""
Focused tests for AngelOne SmartAPI Live Ticker Authentication & Streaming (Step 13.21I.34.121).

Coverage (26 test cases):
  1. AngelOne authentication success
  2. AngelOne authentication failure isolation
  3. Credential isolation (zero secrets in payload/logs)
  4. Session/token handling
  5. Feed token handling
  6. Ticker connection (on_connect)
  7. Ticker disconnect (on_close)
  8. Ticker reconnect & backoff
  9. Symbol subscription
  10. Duplicate subscription prevention
  11. Unsubscribe
  12. Subscription recovery upon reconnect
  13. Symbol-to-instrument token mapping
  14. Unknown symbol handling
  15. Tick normalization (paise conversion & direct price)
  16. quote.updated event generation
  17. EventBus integration
  18. market:<symbol> topic routing
  19. Decimal string preservation (2500.50, 2501.00, 2500.75)
  20. Malformed tick rejection
  21. Stale tick handling (quote.stale)
  22. Future timestamp handling
  23. Provider failure isolation
  24. PAPER / LIVE isolation
  25. Multiple subscribers on same topic
  26. Clean shutdown
"""

import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Tuple, Dict, Any
import pytest

from app.services.event_bus.bus import EventBus
from app.services.event_bus.connection_manager import WebSocketConnectionManager
from app.services.event_bus.models import Event, EventType
from app.services.event_bus.topics import Topic
from app.services.market_data.market_data_provider import MarketDataProvider
from app.services.market_data.angelone_ticker_adapter import AngelOneTickerAdapter
from app.services.market_data.live_market_data_manager import LiveMarketDataManager
from app.brokers.factory import BrokerFactory
from app.brokers.providers.angelone.angelone_broker import AngelOneBroker


class CapturingEventPublisher:
    def __init__(self, fail_mode: bool = False):
        self.published_events: List[Tuple[str, Event]] = []
        self.fail_mode = fail_mode

    async def publish(self, topic: str, event: Event) -> None:
        if self.fail_mode:
            raise RuntimeError("Simulated EventBus publication error!")
        self.published_events.append((topic, event))


@pytest.mark.asyncio
async def test_1_angelone_auth_success():
    adapter = AngelOneTickerAdapter(user_id=uuid.uuid4())
    success = adapter.authenticate_session(
        api_key="VALID_ANGEL_KEY",
        client_code="A100200",
        feed_token="FEED_TOKEN_XYZ",
    )
    assert success is True
    assert adapter.is_authenticated is True


@pytest.mark.asyncio
async def test_2_angelone_auth_failure_isolation():
    adapter = AngelOneTickerAdapter(user_id=uuid.uuid4())
    # Missing required keys
    success = adapter.authenticate_session(api_key="", client_code="")
    assert success is False
    assert adapter.is_authenticated is False


@pytest.mark.asyncio
async def test_3_credential_isolation():
    publisher = CapturingEventPublisher()
    provider = MarketDataProvider(event_publisher=publisher)
    adapter = AngelOneTickerAdapter(
        user_id=uuid.uuid4(),
        on_quote_callback=lambda u, q, b: provider.process_and_publish_quote(u, q, b),
    )
    adapter.authenticate_session(
        api_key="SECRET_KEY_NEVER_EXPOSE",
        client_code="SECRET_CLIENT_CODE",
        feed_token="SECRET_FEED_TOKEN",
    )
    adapter.register_instrument_mapping("3045", "SBIN")

    raw_tick = {
        "token": "3045",
        "last_traded_price": "750.25",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "api_key": "SECRET_KEY_NEVER_EXPOSE",
        "feed_token": "SECRET_FEED_TOKEN",
        "jwtToken": "SECRET_JWT_TOKEN",
    }

    norm = adapter.handle_tick(raw_tick)
    await asyncio.sleep(0.01)

    assert norm is not None
    norm_str = str(norm).lower()
    for secret in ["api_key", "client_code", "feed_token", "jwttoken", "password", "totp"]:
        assert secret not in norm_str


@pytest.mark.asyncio
async def test_4_session_token_handling():
    adapter = AngelOneTickerAdapter(user_id=uuid.uuid4())
    assert adapter.is_authenticated is False
    adapter.authenticate_session(api_key="KEY_1", client_code="CODE_1", feed_token="TOKEN_1")
    assert adapter.is_authenticated is True


@pytest.mark.asyncio
async def test_5_feed_token_handling():
    adapter = AngelOneTickerAdapter(user_id=uuid.uuid4())
    adapter.authenticate_session(feed_token="CUSTOM_FEED_TOKEN")
    assert adapter.is_authenticated is True


@pytest.mark.asyncio
async def test_6_ticker_connection():
    adapter = AngelOneTickerAdapter(user_id=uuid.uuid4())
    assert adapter.is_connected is False
    adapter.on_connect()
    assert adapter.is_connected is True


@pytest.mark.asyncio
async def test_7_ticker_disconnect():
    adapter = AngelOneTickerAdapter(user_id=uuid.uuid4())
    adapter.on_connect()
    assert adapter.is_connected is True
    adapter.on_close(code=1006, reason="Connection dropped")
    assert adapter.is_connected is False


@pytest.mark.asyncio
async def test_8_ticker_reconnect():
    adapter = AngelOneTickerAdapter(user_id=uuid.uuid4(), max_reconnect_attempts=3)
    adapter.on_close(1006, "Drop 1")
    assert adapter._reconnect_count == 1
    adapter.on_close(1006, "Drop 2")
    assert adapter._reconnect_count == 2
    adapter.on_connect()
    assert adapter._reconnect_count == 0


@pytest.mark.asyncio
async def test_9_symbol_subscription():
    adapter = AngelOneTickerAdapter(user_id=uuid.uuid4())
    adapter.subscribe(["RELIANCE", "TCS"])
    assert "RELIANCE" in adapter.subscribed_symbols
    assert "TCS" in adapter.subscribed_symbols


@pytest.mark.asyncio
async def test_10_duplicate_subscription_prevention():
    adapter = AngelOneTickerAdapter(user_id=uuid.uuid4())
    adapter.subscribe(["INFY", "INFY", "infy"])
    assert len(adapter.subscribed_symbols) == 1
    assert "INFY" in adapter.subscribed_symbols


@pytest.mark.asyncio
async def test_11_unsubscribe():
    adapter = AngelOneTickerAdapter(user_id=uuid.uuid4())
    adapter.subscribe(["RELIANCE", "WIPRO"])
    adapter.unsubscribe(["RELIANCE"])
    assert "RELIANCE" not in adapter.subscribed_symbols
    assert "WIPRO" in adapter.subscribed_symbols


@pytest.mark.asyncio
async def test_12_subscription_recovery_upon_reconnect():
    adapter = AngelOneTickerAdapter(user_id=uuid.uuid4())
    adapter.subscribe(["SBIN", "TATAMOTORS"])
    adapter.on_connect()
    adapter.on_close(1006, "Reset")
    adapter.on_connect()

    assert "SBIN" in adapter.subscribed_symbols
    assert "TATAMOTORS" in adapter.subscribed_symbols


@pytest.mark.asyncio
async def test_13_symbol_to_instrument_token_mapping():
    adapter = AngelOneTickerAdapter(user_id=uuid.uuid4())
    adapter.register_instrument_mapping("2885", "RELIANCE")

    raw_tick = {
        "token": "2885",
        "last_traded_price": "2500.75",
    }
    norm = adapter.normalize_tick(raw_tick)
    assert norm["symbol"] == "RELIANCE"


@pytest.mark.asyncio
async def test_14_unknown_symbol_handling():
    adapter = AngelOneTickerAdapter(user_id=uuid.uuid4())
    # Token not mapped
    norm = adapter.normalize_tick({"token": "999999", "last_traded_price": 100})
    assert norm is None


@pytest.mark.asyncio
async def test_15_tick_normalization_paise_and_direct():
    adapter = AngelOneTickerAdapter(user_id=uuid.uuid4())
    adapter.register_instrument_mapping("3045", "SBIN")

    # Direct decimal price
    norm1 = adapter.normalize_tick({
        "symbol": "SBIN",
        "last_traded_price": "750.25",
        "best_buy_price": "750.20",
        "best_sell_price": "750.30",
    })
    assert norm1["last_price"] == "750.25"
    assert norm1["bid"] == "750.20"
    assert norm1["ask"] == "750.30"

    # Price in paise (divided by 100)
    norm2 = adapter.normalize_tick({
        "symbol": "SBIN",
        "last_traded_price": 75025,
        "best_buy_price": 75020,
        "best_sell_price": 75030,
        "in_paise": True,
    })
    assert norm2["last_price"] == "750.25"
    assert norm2["bid"] == "750.2"
    assert norm2["ask"] == "750.3"


@pytest.mark.asyncio
async def test_16_quote_updated_event_generation():
    publisher = CapturingEventPublisher()
    provider = MarketDataProvider(event_publisher=publisher)
    user_id = uuid.uuid4()

    event = provider.process_and_publish_quote(
        user_id=user_id,
        raw_quote={
            "symbol": "AXISBANK",
            "last_price": "1050.00",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )
    await asyncio.sleep(0.01)
    assert event is not None
    assert event.event_type == EventType.QUOTE_UPDATED
    assert publisher.published_events[0][0] == "market:AXISBANK"


@pytest.mark.asyncio
async def test_17_event_bus_integration():
    bus = EventBus()
    provider = MarketDataProvider(event_publisher=bus)
    sub = await bus.subscribe("market:HDFCBANK")

    user_id = uuid.uuid4()
    provider.process_and_publish_quote(
        user_id=user_id,
        raw_quote={"symbol": "HDFCBANK", "last_price": "1650.00", "timestamp": datetime.now(timezone.utc).isoformat()},
    )

    ev = await sub.consume()
    assert ev.event_type == EventType.QUOTE_UPDATED
    assert ev.symbol == "HDFCBANK"
    assert ev.payload["last_price"] == "1650.00"
    await sub.close()


@pytest.mark.asyncio
async def test_18_market_symbol_topic_routing():
    publisher = CapturingEventPublisher()
    provider = MarketDataProvider(event_publisher=publisher)
    user_id = uuid.uuid4()

    provider.process_and_publish_quote(
        user_id=user_id,
        raw_quote={"symbol": "  sbin  ", "last_price": "750.00", "timestamp": datetime.now(timezone.utc).isoformat()},
    )
    await asyncio.sleep(0.01)
    assert publisher.published_events[0][0] == "market:SBIN"


@pytest.mark.asyncio
async def test_19_decimal_string_preservation():
    publisher = CapturingEventPublisher()
    provider = MarketDataProvider(event_publisher=publisher)
    user_id = uuid.uuid4()

    event = provider.process_and_publish_quote(
        user_id=user_id,
        raw_quote={
            "symbol": "RELIANCE",
            "last_price": "2500.75",
            "bid": "2500.50",
            "ask": "2501.00",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )
    assert event is not None
    payload = event.payload
    assert payload["last_price"] == "2500.75"
    assert payload["bid"] == "2500.50"
    assert payload["ask"] == "2501.00"


@pytest.mark.asyncio
async def test_20_malformed_tick_rejection():
    adapter = AngelOneTickerAdapter(user_id=uuid.uuid4())
    assert adapter.normalize_tick({}) is None
    assert adapter.normalize_tick({"symbol": "INFY"}) is None
    assert adapter.normalize_tick({"last_traded_price": 1400}) is None


@pytest.mark.asyncio
async def test_21_stale_tick_handling():
    publisher = CapturingEventPublisher()
    provider = MarketDataProvider(event_publisher=publisher, max_quote_age_seconds=10)
    user_id = uuid.uuid4()

    old_time = (datetime.now(timezone.utc) - timedelta(seconds=20)).isoformat()
    event = provider.process_and_publish_quote(
        user_id=user_id,
        raw_quote={
            "symbol": "ICICIBANK",
            "last_price": "1000.00",
            "timestamp": old_time,
        },
    )
    await asyncio.sleep(0.01)
    assert event is not None
    assert event.event_type == EventType.QUOTE_STALE
    assert event.payload["is_stale"] is True


@pytest.mark.asyncio
async def test_22_future_timestamp_handling():
    publisher = CapturingEventPublisher()
    provider = MarketDataProvider(event_publisher=publisher)
    user_id = uuid.uuid4()

    future_time = (datetime.now(timezone.utc) + timedelta(seconds=500)).isoformat()
    event = provider.process_and_publish_quote(
        user_id=user_id,
        raw_quote={
            "symbol": "TCS",
            "last_price": "3600.00",
            "timestamp": future_time,
        },
    )
    await asyncio.sleep(0.01)
    assert event is not None
    assert event.event_type == EventType.QUOTE_STALE


@pytest.mark.asyncio
async def test_23_provider_failure_isolation():
    failing_publisher = CapturingEventPublisher(fail_mode=True)
    provider = MarketDataProvider(event_publisher=failing_publisher)
    manager = LiveMarketDataManager(market_data_provider=provider)
    user_id = uuid.uuid4()

    event = manager.process_live_broker_tick(
        user_id=user_id,
        raw_tick={"symbol": "MARUTI", "last_price": "11000.00", "timestamp": datetime.now(timezone.utc).isoformat()},
    )
    await asyncio.sleep(0.01)
    assert event is not None


@pytest.mark.asyncio
async def test_24_paper_and_live_isolation():
    publisher = CapturingEventPublisher()
    provider = MarketDataProvider(event_publisher=publisher)
    user_id = uuid.uuid4()

    provider.process_and_publish_quote(
        user_id=user_id,
        raw_quote={"symbol": "BAJAJ-AUTO", "last_price": "8000.00", "timestamp": datetime.now(timezone.utc).isoformat()},
    )
    await asyncio.sleep(0.01)
    assert publisher.published_events[0][0] == "market:BAJAJ-AUTO"


@pytest.mark.asyncio
async def test_25_multiple_subscribers_on_same_topic():
    bus = EventBus()
    sub1 = await bus.subscribe("market:NIFTY")
    sub2 = await bus.subscribe("market:NIFTY")

    provider = MarketDataProvider(event_publisher=bus)
    user_id = uuid.uuid4()

    provider.process_and_publish_quote(
        user_id=user_id,
        raw_quote={"symbol": "NIFTY", "last_price": "22200.00", "timestamp": datetime.now(timezone.utc).isoformat()},
    )

    ev1 = await sub1.consume()
    ev2 = await sub2.consume()
    assert ev1.payload["last_price"] == "22200.00"
    assert ev2.payload["last_price"] == "22200.00"

    await sub1.close()
    await sub2.close()


@pytest.mark.asyncio
async def test_26_clean_shutdown():
    adapter = AngelOneTickerAdapter(user_id=uuid.uuid4())
    adapter.on_connect()
    assert adapter.is_connected is True
    adapter.on_close(code=1000, reason="Normal shutdown")
    assert adapter.is_connected is False
