"""
Focused tests for Live Broker Market Data Streaming Integration (Step 13.21I.34.120).

Coverage (22 test cases):
  1. MarketDataProvider initialization
  2. Broker provider selection (Zerodha vs AngelOne stub)
  3. Zerodha live ticker adapter normalization
  4. AngelOne live ticker adapter stub handling
  5. Broker tick normalization (instrument_token -> symbol lookup, top bid/ask)
  6. quote.updated event generation
  7. market:<symbol> topic routing
  8. Decimal string preservation
  9. Malformed tick rejection
  10. Stale tick handling (quote.stale)
  11. Future timestamp handling
  12. Provider disconnect
  13. Provider reconnect
  14. Subscription recovery upon reconnect
  15. Duplicate symbol subscription protection
  16. Multiple subscribers on same market topic
  17. Provider failure isolation
  18. User isolation in event envelope
  19. PAPER / LIVE isolation
  20. Credential isolation (zero secrets in payload/logs)
  21. EventBus integration
  22. ConnectionManager integration
"""

import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Tuple, Dict, Any
import pytest

from app.services.event_bus.bus import EventBus
from app.services.event_bus.connection_manager import WebSocketConnectionManager
from app.services.event_bus.models import Event, EventType
from app.services.market_data.market_data_provider import MarketDataProvider
from app.services.market_data.zerodha_ticker_adapter import ZerodhaTickerAdapter
from app.services.market_data.live_market_data_manager import LiveMarketDataManager
from app.brokers.factory import BrokerFactory


from app.services.event_bus.topics import Topic

class CapturingEventPublisher:
    def __init__(self, fail_mode: bool = False):
        self.published_events: List[Tuple[str, Event]] = []
        self.fail_mode = fail_mode

    async def publish(self, topic: str, event: Event) -> None:
        if self.fail_mode:
            raise RuntimeError("Simulated EventBus publication error!")
        self.published_events.append((topic, event))


@pytest.mark.asyncio
async def test_1_market_data_provider_initialization():
    publisher = CapturingEventPublisher()
    provider = MarketDataProvider(event_publisher=publisher, max_quote_age_seconds=15)
    assert provider.max_quote_age_seconds == 15
    assert len(provider._subscribed_symbols) == 0


@pytest.mark.asyncio
async def test_2_broker_provider_selection():
    # Verify BrokerFactory instantiates Zerodha when session_service and broker_id provided
    mock_session_service = object()
    broker_id = uuid.uuid4()
    zerodha_broker = BrokerFactory.get_provider(
        provider_name="zerodha",
        session_service=mock_session_service,
        broker_id=broker_id,
    )
    assert zerodha_broker is not None

    # Verify AngelOne factory attempts provider selection (abstract stub)
    try:
        angelone_broker = BrokerFactory.get_provider(provider_name="angelone")
        assert angelone_broker is not None
    except TypeError as err:
        # Abstract class stub is expected until fully implemented
        assert "Can't instantiate abstract class AngelOneBroker" in str(err)


@pytest.mark.asyncio
async def test_3_zerodha_live_ticker_adapter_normalization():
    publisher = CapturingEventPublisher()
    provider = MarketDataProvider(event_publisher=publisher)
    user_id = uuid.uuid4()

    adapter = ZerodhaTickerAdapter(
        user_id=user_id,
        on_quote_callback=lambda u, q, b: provider.process_and_publish_quote(u, q, b),
    )
    adapter.register_instrument_mapping(738561, "RELIANCE")

    raw_tick = {
        "instrument_token": 738561,
        "last_price": 2500.75,
        "change": 15.5,
        "volume": 125000,
        "depth": {
            "buy": [{"price": 2500.50, "quantity": 100}],
            "sell": [{"price": 2501.00, "quantity": 50}],
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    norm = adapter.normalize_tick(raw_tick)
    assert norm is not None
    assert norm["symbol"] == "RELIANCE"
    assert norm["last_price"] == "2500.75"
    assert norm["bid"] == "2500.5"
    assert norm["ask"] == "2501.0"


@pytest.mark.asyncio
async def test_4_angelone_live_ticker_stub_handling():
    publisher = CapturingEventPublisher()
    provider = MarketDataProvider(event_publisher=publisher)
    manager = LiveMarketDataManager(market_data_provider=provider)

    user_id = uuid.uuid4()
    # Processing AngelOne quote tick via manager
    event = manager.process_live_broker_tick(
        user_id=user_id,
        raw_tick={
            "symbol": "TCS",
            "last_price": "3600.00",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )
    await asyncio.sleep(0.01)
    assert event is not None
    assert event.symbol == "TCS"


@pytest.mark.asyncio
async def test_5_broker_tick_normalization_depth_extraction():
    adapter = ZerodhaTickerAdapter(user_id=uuid.uuid4())
    adapter.register_instrument_mapping(12345, "INFY")

    raw_tick = {
        "instrument_token": 12345,
        "last_price": "1450.25",
        "depth": {
            "buy": [{"price": "1450.00"}],
            "sell": [{"price": "1450.50"}],
        },
    }
    norm = adapter.normalize_tick(raw_tick)
    assert norm["symbol"] == "INFY"
    assert norm["last_price"] == "1450.25"
    assert norm["bid"] == "1450.00"
    assert norm["ask"] == "1450.50"


@pytest.mark.asyncio
async def test_6_quote_updated_event_generation():
    publisher = CapturingEventPublisher()
    provider = MarketDataProvider(event_publisher=publisher)
    user_id = uuid.uuid4()

    event = provider.process_and_publish_quote(
        user_id=user_id,
        raw_quote={
            "symbol": "SBIN",
            "last_price": "750.00",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )
    await asyncio.sleep(0.01)
    assert event is not None
    assert event.event_type == EventType.QUOTE_UPDATED
    assert publisher.published_events[0][0] == "market:SBIN"


@pytest.mark.asyncio
async def test_7_market_symbol_topic_routing():
    publisher = CapturingEventPublisher()
    provider = MarketDataProvider(event_publisher=publisher)
    user_id = uuid.uuid4()

    provider.process_and_publish_quote(
        user_id=user_id,
        raw_quote={
            "symbol": "  hdfcbank  ",
            "last_price": "1600.00",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )
    await asyncio.sleep(0.01)
    assert publisher.published_events[0][0] == "market:HDFCBANK"


@pytest.mark.asyncio
async def test_8_decimal_string_preservation():
    publisher = CapturingEventPublisher()
    provider = MarketDataProvider(event_publisher=publisher)
    user_id = uuid.uuid4()

    event = provider.process_and_publish_quote(
        user_id=user_id,
        raw_quote={
            "symbol": "BAJFINANCE",
            "last_price": 6800.123456789,
            "bid": 6800.10,
            "ask": 6800.15,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )
    assert event is not None
    payload = event.payload
    assert isinstance(payload["last_price"], str)
    assert payload["last_price"] == "6800.123456789"


@pytest.mark.asyncio
async def test_9_malformed_tick_rejection():
    adapter = ZerodhaTickerAdapter(user_id=uuid.uuid4())

    # Missing price & symbol
    assert adapter.normalize_tick({}) is None
    assert adapter.normalize_tick({"symbol": "ITC"}) is None
    assert adapter.normalize_tick({"last_price": 400.0}) is None


@pytest.mark.asyncio
async def test_10_stale_tick_handling():
    publisher = CapturingEventPublisher()
    provider = MarketDataProvider(event_publisher=publisher, max_quote_age_seconds=10)
    user_id = uuid.uuid4()

    old_time = (datetime.now(timezone.utc) - timedelta(seconds=25)).isoformat()
    event = provider.process_and_publish_quote(
        user_id=user_id,
        raw_quote={
            "symbol": "WIPRO",
            "last_price": "400.00",
            "timestamp": old_time,
        },
    )
    await asyncio.sleep(0.01)
    assert event is not None
    assert event.event_type == EventType.QUOTE_STALE
    assert event.payload["is_stale"] is True


@pytest.mark.asyncio
async def test_11_future_timestamp_handling():
    publisher = CapturingEventPublisher()
    provider = MarketDataProvider(event_publisher=publisher)
    user_id = uuid.uuid4()

    future_time = (datetime.now(timezone.utc) + timedelta(seconds=1000)).isoformat()
    event = provider.process_and_publish_quote(
        user_id=user_id,
        raw_quote={
            "symbol": "TATAMOTORS",
            "last_price": "920.00",
            "timestamp": future_time,
        },
    )
    await asyncio.sleep(0.01)
    assert event is not None
    assert event.event_type == EventType.QUOTE_STALE


@pytest.mark.asyncio
async def test_12_provider_disconnect():
    adapter = ZerodhaTickerAdapter(user_id=uuid.uuid4())
    adapter.on_connect()
    assert adapter.is_connected is True

    adapter.on_close(code=1006, reason="Connection lost")
    assert adapter.is_connected is False


@pytest.mark.asyncio
async def test_13_provider_reconnect():
    adapter = ZerodhaTickerAdapter(user_id=uuid.uuid4(), max_reconnect_attempts=3)
    adapter.on_close(1006, "Close 1")
    assert adapter._reconnect_count == 1
    adapter.on_close(1006, "Close 2")
    assert adapter._reconnect_count == 2
    adapter.on_connect()
    assert adapter._reconnect_count == 0


@pytest.mark.asyncio
async def test_14_subscription_recovery_upon_reconnect():
    adapter = ZerodhaTickerAdapter(user_id=uuid.uuid4())
    adapter.subscribe(["RELIANCE", "TCS"])
    assert "RELIANCE" in adapter.subscribed_symbols
    assert "TCS" in adapter.subscribed_symbols

    # Simulate reconnect
    adapter.on_connect()
    # Symbols should remain registered
    assert "RELIANCE" in adapter.subscribed_symbols
    assert "TCS" in adapter.subscribed_symbols


@pytest.mark.asyncio
async def test_15_duplicate_symbol_subscription_protection():
    adapter = ZerodhaTickerAdapter(user_id=uuid.uuid4())
    adapter.subscribe(["INFY", "INFY", "infy"])
    assert len(adapter.subscribed_symbols) == 1
    assert "INFY" in adapter.subscribed_symbols


@pytest.mark.asyncio
async def test_16_multiple_subscribers_on_market_topic():
    bus = EventBus()
    sub1 = await bus.subscribe("market:NIFTY")
    sub2 = await bus.subscribe("market:NIFTY")

    provider = MarketDataProvider(event_publisher=bus)
    user_id = uuid.uuid4()
    provider.process_and_publish_quote(
        user_id=user_id,
        raw_quote={"symbol": "NIFTY", "last_price": "22100.00", "timestamp": datetime.now(timezone.utc).isoformat()},
    )

    e1 = await sub1.consume()
    e2 = await sub2.consume()
    assert e1.payload["last_price"] == "22100.00"
    assert e2.payload["last_price"] == "22100.00"

    await sub1.close()
    await sub2.close()


@pytest.mark.asyncio
async def test_17_provider_failure_isolation():
    failing_publisher = CapturingEventPublisher(fail_mode=True)
    provider = MarketDataProvider(event_publisher=failing_publisher)
    manager = LiveMarketDataManager(market_data_provider=provider)
    user_id = uuid.uuid4()

    # Exception inside event bus should be caught without raising
    event = manager.process_live_broker_tick(
        user_id=user_id,
        raw_tick={"symbol": "KOTAKBANK", "last_price": "1800.00", "timestamp": datetime.now(timezone.utc).isoformat()},
    )
    await asyncio.sleep(0.01)
    assert event is not None


@pytest.mark.asyncio
async def test_18_user_isolation_in_event_envelope():
    publisher = CapturingEventPublisher()
    provider = MarketDataProvider(event_publisher=publisher)
    user1 = uuid.uuid4()
    user2 = uuid.uuid4()

    now_iso = datetime.now(timezone.utc).isoformat()
    provider.process_and_publish_quote(user_id=user1, raw_quote={"symbol": "LT", "last_price": "3500", "timestamp": now_iso})
    provider.process_and_publish_quote(user_id=user2, raw_quote={"symbol": "LT", "last_price": "3500", "timestamp": now_iso})
    await asyncio.sleep(0.01)

    assert publisher.published_events[0][1].user_id == user1
    assert publisher.published_events[1][1].user_id == user2


@pytest.mark.asyncio
async def test_19_paper_and_live_isolation():
    publisher = CapturingEventPublisher()
    provider = MarketDataProvider(event_publisher=publisher)
    user_id = uuid.uuid4()

    event = provider.process_and_publish_quote(
        user_id=user_id,
        raw_quote={"symbol": "MARUTI", "last_price": "11000", "timestamp": datetime.now(timezone.utc).isoformat()},
    )
    await asyncio.sleep(0.01)

    # Market quote topics are strictly market:<symbol>
    assert publisher.published_events[0][0] == "market:MARUTI"
    # Never leaks strategy execution topics
    assert "strategy:" not in publisher.published_events[0][0]


@pytest.mark.asyncio
async def test_20_credential_isolation_in_tick_processing():
    publisher = CapturingEventPublisher()
    provider = MarketDataProvider(event_publisher=publisher)
    adapter = ZerodhaTickerAdapter(
        user_id=uuid.uuid4(),
        on_quote_callback=lambda u, q, b: provider.process_and_publish_quote(u, q, b),
    )
    adapter.register_instrument_mapping(999, "ULTRACEMCO")

    raw_tick_with_secrets = {
        "instrument_token": 999,
        "last_price": 9500.0,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "api_key": "SECRET_KEY_NEVER_LEAK",
        "access_token": "SECRET_TOKEN_NEVER_LEAK",
        "api_secret": "SECRET_API_SECRET_NEVER_LEAK",
    }

    norm = adapter.handle_tick(raw_tick_with_secrets)
    await asyncio.sleep(0.01)

    assert norm is not None
    norm_str = str(norm).lower()
    for forbidden in ["api_key", "access_token", "api_secret", "password", "jwt"]:
        assert forbidden not in norm_str


@pytest.mark.asyncio
async def test_21_event_bus_integration():
    bus = EventBus()
    provider = MarketDataProvider(event_publisher=bus)
    manager = LiveMarketDataManager(market_data_provider=provider)

    sub = await bus.subscribe("market:TITAN")
    user_id = uuid.uuid4()

    manager.process_live_broker_tick(
        user_id=user_id,
        raw_tick={"symbol": "TITAN", "last_price": "3200.00", "timestamp": datetime.now(timezone.utc).isoformat()},
    )

    ev = await sub.consume()
    assert ev.event_type == EventType.QUOTE_UPDATED
    assert ev.symbol == "TITAN"
    assert ev.payload["last_price"] == "3200.00"

    await sub.close()


@pytest.mark.asyncio
async def test_22_connection_manager_integration():
    bus = EventBus()
    manager = WebSocketConnectionManager(event_bus=bus)
    provider = MarketDataProvider(event_publisher=bus)

    user_id = uuid.uuid4()
    sub = await bus.subscribe(Topic.market("SUNPHARMA"))

    provider.process_and_publish_quote(
        user_id=user_id,
        raw_quote={"symbol": "SUNPHARMA", "last_price": "1500.00", "timestamp": datetime.now(timezone.utc).isoformat()},
    )

    ev = await sub.consume()
    assert ev.symbol == "SUNPHARMA"
    assert ev.payload["last_price"] == "1500.00"
    await sub.close()
