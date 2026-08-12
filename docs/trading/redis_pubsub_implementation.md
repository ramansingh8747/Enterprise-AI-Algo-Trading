# Redis Pub/Sub Multi-Worker Market Data Broadcasting (`Step 13.21I.34.122`)

## 1. Objective

Implement Redis Pub/Sub support for multi-worker and multi-instance broadcasting of real-time market data events across application worker nodes.

---

## 2. Architecture & Data Flow

```
[Producer / Worker A]
          │
          ▼
 [MarketDataProvider]
          │
          ▼
   [EventBus.publish()]
     ┌────┴──────────────────────────┐
     ▼                               ▼
[Local Subscribers]      [RedisEventTransport.publish()]
                                     │ (Channel "trading:events")
                                     ▼
                              [Redis Pub/Sub]
                                     │
                                     ▼
                         [Worker B RedisEventTransport]
                                     │ (Event payload with from_redis=True)
                                     ▼
                         [Worker B EventBus.publish()]
                                     │
                                     ▼
                     [Worker B WebSocket ConnectionManager]
                                     │
                                     ▼
                         [market:<symbol> Topic]
                                     │
                                     ▼
                          [Frontend WS Clients]
```

---

## 3. Core Technical Components

### 3.1 Redis Event Transport (`backend/app/infrastructure/redis/redis_transport.py`)
- **`RedisEventTransport` Adapter:** Manages async connection to Redis channel `"trading:events"`.
- **Envelope Serialization:** Serializes `(topic, Event)` into JSON, preserving exact string Decimal representations (`"2500.50"`), timestamps, `event_id`, and `user_id`.
- **Cross-Worker Deserialization:** Converts incoming Redis messages back into canonical `Event` objects and dispatches them to the local `EventBus` with `from_redis=True`.
- **Fail-Safe Isolation:** If Redis is down or unreachable, catches connection exceptions, logs warnings (without exposing credentials), and falls back gracefully to local single-worker mode.

### 3.2 EventBus Integration (`backend/app/services/event_bus/bus.py`)
- Added `set_redis_transport(transport)` method to attach `RedisEventTransport`.
- Updated `publish(topic, event, from_redis=False)`:
  1. Always dispatches events to local topic subscribers.
  2. If `from_redis` is `False` and `_redis_transport` is active, forwards event to Redis Pub/Sub.
  3. If `from_redis` is `True`, skips republishing to Redis, preventing infinite event loops.

---

## 4. Verification & Test Results

### 4.1 Backend Test Suite (`backend/app/tests/services/test_redis_pubsub.py`)
- **Result:** 15 passed / 0 failed
- **Combined Market Data Suite (`test_angelone_market_data.py` + `test_live_broker_market_data.py`):** 48 passed / 0 failed
- **Full Backend Pytest Suite:** 313 passed / 3 failed (3 pre-existing environment Fernet key failures)
- Tests covered: Redis publish, Redis subscribe & message processing, event envelope serialization, Decimal string preservation (`"2500.50"`), `quote.updated` transport across Redis Pub/Sub, `from_redis=True` origin handling, multi-worker event propagation simulation, duplicate processing protection, Redis disconnect, Redis reconnect, Redis failure isolation, clean shutdown, credential isolation, event loop prevention, and `market:<symbol>` routing after Redis transport.

---

## 5. Security & Boundary Rules

- **Zero Credential Exposure:** Redis messages contain strictly market quote data (`symbol`, `last_price`, `bid`, `ask`, `timestamp`). No API keys, secrets, feed tokens, JWTs, or broker passwords ever enter Redis payloads.
- **REST & DB Integrity:** REST API contract and database schemas remain unchanged (0 migrations created).
- **PAPER/LIVE Isolation:** Preserves `user_id` and trading execution mode context within the canonical `Event` envelope.

---

## 6. Known Limitations

- Multi-worker setup requires an active Redis server instance for cross-process broadcasting. Single-instance setups continue operating seamlessly without Redis.
