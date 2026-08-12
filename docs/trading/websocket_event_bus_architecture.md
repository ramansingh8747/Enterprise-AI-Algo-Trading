# WebSocket Event Bus & Real-Time Infrastructure Architecture

## 1. Overview
This document defines the architecture for a real-time event-driven infrastructure to support Strategy lifecycle events, signal history, and market data streaming.

## 2. Event Model
A canonical event envelope is used for all messages.

```json
{
  "event_id": "uuid",
  "event_type": "string",
  "timestamp": "iso8601",
  "user_id": "uuid",
  "strategy_instance_id": "uuid",
  "payload": "object"
}
```

### Event Types
- `strategy.created`, `strategy.updated`, `strategy.deleted`
- `instance.started`, `instance.paused`, `instance.resumed`, `instance.stopped`, `instance.failed`
- `signal.generated`, `signal.rejected`, `signal.executed`
- `quote.updated`, `quote.stale`

## 3. Backend Asyncio Event Bus
A central `asyncio.Queue`-based event bus will decouple event production from WebSocket broadcasting.
- **Interface:** `EventPublisher` (for StrategyEngine) and `EventSubscriber` (for ConnectionManager).
- **Production:** Redis Pub/Sub will replace the in-memory bus to allow multi-worker scaling.

## 4. WebSocket Infrastructure
- **ConnectionManager:** Manages `WebSocket` connections, authentication, and subscription maps.
- **Isolation:** Maps `connection` to `user_id` and filters events based on user/strategy ownership.

## 5. Authentication & Authorization
- **Handshake:** JWT passed via `Authorization` header during the initial WebSocket handshake.
- **Verification:** FastAPI `Depends(get_current_active_user)` on the WebSocket route.

## 6. Subscription Model
Subscriptions are keyed by `(user_id, topic)`.
- Topics: `market:symbol`, `strategy:instance_id`
- Authorization: Checked on subscription initiation.

## 7. PAPER/LIVE Isolation
- Topics are namespaced: `paper:strategy:instance_id` and `live:strategy:instance_id`.
- ConnectionManager enforces that a connection authorized for PAPER cannot subscribe to LIVE topics.

## 8. Market Data Architecture
- **MarketDataProvider:** Interface for streaming quotes.
- **Stale Data Guard:** Maintains the current `StrategyRunner` validation logic.

## 9. Frontend Client
- **WebSocketProvider (React Context):** Manages connection lifecycle (connect, disconnect, auth).
- **useWebSocketSubscription Hook:** Simplifies topic subscription and state updates.

## 10. Reconnect, Heartbeat, Snapshot
- **Reconnect:** Exponential backoff + jitter.
- **Heartbeat:** Server-side ping/pong every 30s.
- **Snapshot:** On successful reconnect, frontend requests snapshot via REST to synchronize state.

## 11. Security, Observability, Concurrency
- **Security:** No credentials in messages, topic-based authorization.
- **Observability:** Metrics for active connections, message latency, event drops.
- **Concurrency:** FastAPI's `async` handling allows high-concurrency event broadcasting.
