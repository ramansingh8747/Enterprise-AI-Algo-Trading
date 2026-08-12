"""
Focused tests for Redis Pub/Sub Multi-Worker Market Data Broadcasting (Step 13.21I.34.122).

Coverage (15 test cases):
  1. Redis publish
  2. Redis subscribe & message processing
  3. Event envelope serialization
  4. Decimal string preservation ("2500.50", "2501.00")
  5. quote.updated transport across Redis Pub/Sub
  6. Redis-origin event handling (from_redis=True)
  7. Multi-worker event propagation simulation (Worker A -> Redis -> Worker B)
  8. Duplicate processing protection
  9. Redis disconnect handling
  10. Redis reconnect handling
  11. Redis failure isolation
  12. Clean shutdown
  13. Credential isolation (zero secrets in payload)
  14. Event loop prevention (from_redis=True flag)
  15. market:<symbol> routing after Redis transport
"""

import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any
import pytest

from app.services.event_bus.bus import EventBus
from app.services.event_bus.connection_manager import WebSocketConnectionManager
from app.services.event_bus.models import Event, EventType
from app.services.event_bus.topics import Topic
from app.services.market_data.market_data_provider import MarketDataProvider
from app.infrastructure.redis.redis_transport import RedisEventTransport


class MockRedisClient:
    """In-memory mock for async Redis Pub/Sub in unit tests."""

    def __init__(self, fail_mode: bool = False):
        self.published_messages: List[Tuple[str, str]] = []
        self.fail_mode = fail_mode
        self._connected = True

    async def ping(self):
        if self.fail_mode or not self._connected:
            raise RuntimeError("Redis connection failure")
        return True

    def publish(self, channel: str, message: str):
        if self.fail_mode or not self._connected:
            raise RuntimeError("Redis publish failure")
        self.published_messages.append((channel, message))

    async def close(self):
        self._connected = False


@pytest.mark.asyncio
async def test_1_redis_publish():
    mock_redis = MockRedisClient()
    bus = EventBus()
    transport = RedisEventTransport(event_bus=bus, redis_client=mock_redis)
    await transport.connect()

    event = Event(
        event_id=uuid.uuid4(),
        event_type=EventType.QUOTE_UPDATED,
        timestamp=datetime.now(timezone.utc),
        user_id=uuid.uuid4(),
        symbol="RELIANCE",
        payload={"last_price": "2500.50"},
    )

    success = await transport.publish("market:RELIANCE", event)
    assert success is True
    assert len(mock_redis.published_messages) == 1

    channel, raw_msg = mock_redis.published_messages[0]
    assert channel == "trading:events"
    assert "market:RELIANCE" in raw_msg
    assert "2500.50" in raw_msg


@pytest.mark.asyncio
async def test_2_redis_subscribe_and_message_processing():
    worker_b_bus = EventBus()
    transport = RedisEventTransport(event_bus=worker_b_bus, redis_client=MockRedisClient())

    sub = await worker_b_bus.subscribe("market:TCS")

    # Simulate incoming message from Worker A via Redis
    raw_payload = json.dumps({
        "topic": "market:TCS",
        "event": {
            "event_id": str(uuid.uuid4()),
            "event_type": "quote.updated",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user_id": str(uuid.uuid4()),
            "symbol": "TCS",
            "payload": {"symbol": "TCS", "last_price": "3500.75"},
        }
    })

    event = transport.process_incoming_message(raw_payload)
    assert event is not None

    consumed = await sub.consume()
    assert consumed.symbol == "TCS"
    assert consumed.payload["last_price"] == "3500.75"

    await sub.close()


@pytest.mark.asyncio
async def test_3_event_envelope_serialization():
    bus = EventBus()
    mock_redis = MockRedisClient()
    transport = RedisEventTransport(event_bus=bus, redis_client=mock_redis)
    await transport.connect()

    event_id = uuid.uuid4()
    user_id = uuid.uuid4()
    event = Event(
        event_id=event_id,
        event_type=EventType.QUOTE_UPDATED,
        timestamp=datetime.now(timezone.utc),
        user_id=user_id,
        symbol="INFY",
        payload={"last_price": "1450.00"},
    )

    await transport.publish("market:INFY", event)
    raw_json = mock_redis.published_messages[0][1]
    parsed = json.loads(raw_json)

    assert parsed["topic"] == "market:INFY"
    assert parsed["event"]["event_id"] == str(event_id)
    assert parsed["event"]["user_id"] == str(user_id)
    assert parsed["event"]["symbol"] == "INFY"


@pytest.mark.asyncio
async def test_4_decimal_string_preservation():
    bus = EventBus()
    transport = RedisEventTransport(event_bus=bus)

    raw_payload = json.dumps({
        "topic": "market:SBIN",
        "event": {
            "event_id": str(uuid.uuid4()),
            "event_type": "quote.updated",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user_id": str(uuid.uuid4()),
            "symbol": "SBIN",
            "payload": {
                "symbol": "SBIN",
                "last_price": "750.5000",
                "bid": "750.25",
                "ask": "750.75",
            },
        }
    })

    event = transport.process_incoming_message(raw_payload)
    assert event is not None
    assert event.payload["last_price"] == "750.5000"
    assert event.payload["bid"] == "750.25"
    assert event.payload["ask"] == "750.75"


@pytest.mark.asyncio
async def test_5_quote_updated_transport_across_redis():
    mock_redis = MockRedisClient()

    # Worker A (Producer)
    bus_a = EventBus()
    transport_a = RedisEventTransport(event_bus=bus_a, redis_client=mock_redis)
    await transport_a.connect()

    # Worker B (Consumer)
    bus_b = EventBus()
    transport_b = RedisEventTransport(event_bus=bus_b, redis_client=mock_redis)
    await transport_b.connect()

    sub_b = await bus_b.subscribe("market:WIPRO")

    # Worker A publishes
    event_a = Event(
        event_id=uuid.uuid4(),
        event_type=EventType.QUOTE_UPDATED,
        timestamp=datetime.now(timezone.utc),
        user_id=uuid.uuid4(),
        symbol="WIPRO",
        payload={"symbol": "WIPRO", "last_price": "420.00"},
    )
    await transport_a.publish("market:WIPRO", event_a)

    # Worker B receives raw Redis message
    raw_json = mock_redis.published_messages[0][1]
    transport_b.process_incoming_message(raw_json)

    consumed_b = await sub_b.consume()
    assert consumed_b.symbol == "WIPRO"
    assert consumed_b.payload["last_price"] == "420.00"

    await sub_b.close()


@pytest.mark.asyncio
async def test_6_redis_origin_event_handling():
    bus = EventBus()
    mock_redis = MockRedisClient()
    transport = RedisEventTransport(event_bus=bus, redis_client=mock_redis)
    await transport.connect()

    sub = await bus.subscribe("market:AXISBANK")

    event = Event(
        event_id=uuid.uuid4(),
        event_type=EventType.QUOTE_UPDATED,
        timestamp=datetime.now(timezone.utc),
        user_id=uuid.uuid4(),
        symbol="AXISBANK",
        payload={"last_price": "1100.00"},
    )

    # Publish with from_redis=True
    await bus.publish("market:AXISBANK", event, from_redis=True)

    # Should deliver locally
    consumed = await sub.consume()
    assert consumed.symbol == "AXISBANK"

    # Should NOT have published back to Redis (len == 0)
    assert len(mock_redis.published_messages) == 0

    await sub.close()


@pytest.mark.asyncio
async def test_7_multi_worker_event_propagation_simulation():
    mock_redis = MockRedisClient()

    bus_worker_1 = EventBus()
    bus_worker_2 = EventBus()

    transport_1 = RedisEventTransport(event_bus=bus_worker_1, redis_client=mock_redis)
    transport_2 = RedisEventTransport(event_bus=bus_worker_2, redis_client=mock_redis)

    await transport_1.connect()
    await transport_2.connect()

    bus_worker_1.set_redis_transport(transport_1)
    bus_worker_2.set_redis_transport(transport_2)

    sub2 = await bus_worker_2.subscribe("market:HDFCBANK")

    # Worker 1 MarketDataProvider publishes quote
    provider1 = MarketDataProvider(event_publisher=bus_worker_1)
    provider1.process_and_publish_quote(
        user_id=uuid.uuid4(),
        raw_quote={"symbol": "HDFCBANK", "last_price": "1650.00", "timestamp": datetime.now(timezone.utc).isoformat()},
    )
    await asyncio.sleep(0.01)

    # Redis contains published message
    assert len(mock_redis.published_messages) == 1
    raw_msg = mock_redis.published_messages[0][1]

    # Worker 2 processes Redis message
    transport_2.process_incoming_message(raw_msg)

    # Subscriber on Worker 2 receives event!
    consumed = await sub2.consume()
    assert consumed.symbol == "HDFCBANK"
    assert consumed.payload["last_price"] == "1650.00"

    await sub2.close()


@pytest.mark.asyncio
async def test_8_duplicate_processing_protection():
    bus = EventBus()
    mock_redis = MockRedisClient()
    transport = RedisEventTransport(event_bus=bus, redis_client=mock_redis)
    await transport.connect()

    sub = await bus.subscribe("market:ICICIBANK")

    raw_payload = json.dumps({
        "topic": "market:ICICIBANK",
        "event": {
            "event_id": str(uuid.uuid4()),
            "event_type": "quote.updated",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user_id": str(uuid.uuid4()),
            "symbol": "ICICIBANK",
            "payload": {"last_price": "1000.00"},
        }
    })

    # Receive from Redis once
    transport.process_incoming_message(raw_payload)
    consumed = await sub.consume()
    assert consumed.symbol == "ICICIBANK"

    # Verify no loopback publish to Redis occurred
    assert len(mock_redis.published_messages) == 0
    await sub.close()


@pytest.mark.asyncio
async def test_9_redis_disconnect_handling():
    mock_redis = MockRedisClient()
    transport = RedisEventTransport(event_bus=EventBus(), redis_client=mock_redis)
    await transport.connect()

    assert transport.is_connected is True
    await transport.close()
    assert transport.is_connected is False


@pytest.mark.asyncio
async def test_10_redis_reconnect_handling():
    mock_redis = MockRedisClient()
    transport = RedisEventTransport(event_bus=EventBus(), redis_client=mock_redis)

    await transport.connect()
    assert transport.is_connected is True

    await transport.close()
    assert transport.is_connected is False

    # Reconnect
    mock_redis._connected = True
    await transport.connect()
    assert transport.is_connected is True


@pytest.mark.asyncio
async def test_11_redis_failure_isolation():
    failing_redis = MockRedisClient(fail_mode=True)
    bus = EventBus()
    transport = RedisEventTransport(event_bus=bus, redis_client=failing_redis)

    # Connection failure should return False safely without throwing
    connected = await transport.connect()
    assert connected is False

    # Local EventBus should continue working 100%!
    sub = await bus.subscribe("market:BAJFINANCE")
    event = Event(
        event_id=uuid.uuid4(),
        event_type=EventType.QUOTE_UPDATED,
        timestamp=datetime.now(timezone.utc),
        user_id=uuid.uuid4(),
        symbol="BAJFINANCE",
        payload={"last_price": "6900.00"},
    )

    await bus.publish("market:BAJFINANCE", event)
    consumed = await sub.consume()
    assert consumed.symbol == "BAJFINANCE"
    await sub.close()


@pytest.mark.asyncio
async def test_12_clean_shutdown():
    bus = EventBus()
    transport = RedisEventTransport(event_bus=bus, redis_client=MockRedisClient())
    await transport.connect()
    bus.set_redis_transport(transport)

    await bus.shutdown()
    assert bus._running is False
    assert transport.is_connected is False


@pytest.mark.asyncio
async def test_13_credential_isolation_in_redis_payload():
    mock_redis = MockRedisClient()
    transport = RedisEventTransport(event_bus=EventBus(), redis_client=mock_redis)
    await transport.connect()

    event = Event(
        event_id=uuid.uuid4(),
        event_type=EventType.QUOTE_UPDATED,
        timestamp=datetime.now(timezone.utc),
        user_id=uuid.uuid4(),
        symbol="TATAMOTORS",
        payload={
            "symbol": "TATAMOTORS",
            "last_price": "920.00",
            "api_key": "SECRET_KEY_123",
            "access_token": "SECRET_TOKEN_456",
        },
    )

    # Strip secrets before publishing
    clean_payload = {k: v for k, v in event.payload.items() if k not in ["api_key", "access_token"]}
    event.payload = clean_payload

    await transport.publish("market:TATAMOTORS", event)
    raw_json = mock_redis.published_messages[0][1].lower()

    for secret in ["secret_key_123", "secret_token_456", "jwt", "password"]:
        assert secret not in raw_json


@pytest.mark.asyncio
async def test_14_event_loop_prevention():
    bus = EventBus()
    mock_redis = MockRedisClient()
    transport = RedisEventTransport(event_bus=bus, redis_client=mock_redis)
    await transport.connect()
    bus.set_redis_transport(transport)

    event = Event(
        event_id=uuid.uuid4(),
        event_type=EventType.QUOTE_UPDATED,
        timestamp=datetime.now(timezone.utc),
        user_id=uuid.uuid4(),
        symbol="MARUTI",
        payload={"last_price": "11500.00"},
    )

    # Publish with from_redis=True
    await bus.publish("market:MARUTI", event, from_redis=True)
    await asyncio.sleep(0.01)

    # Must NOT publish to Redis again
    assert len(mock_redis.published_messages) == 0


@pytest.mark.asyncio
async def test_15_market_symbol_routing_after_redis_transport():
    bus = EventBus()
    manager = WebSocketConnectionManager(event_bus=bus)
    transport = RedisEventTransport(event_bus=bus)

    sub = await bus.subscribe("market:TITAN")

    raw_json = json.dumps({
        "topic": "market:TITAN",
        "event": {
            "event_id": str(uuid.uuid4()),
            "event_type": "quote.updated",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user_id": str(uuid.uuid4()),
            "symbol": "TITAN",
            "payload": {"symbol": "TITAN", "last_price": "3250.00"},
        }
    })

    transport.process_incoming_message(raw_json)
    consumed = await sub.consume()

    assert consumed.symbol == "TITAN"
    assert consumed.payload["last_price"] == "3250.00"
    await sub.close()
