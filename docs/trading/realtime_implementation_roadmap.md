# Real-Time Implementation Roadmap

## Implementation Steps

1. **Step 115: Define Event Bus Interface + In-Memory Implementation**
   - **Objective:** Backend infra for event publishing/subscribing.
   - **Dependencies:** None.

2. **Step 116: Backend WebSocket Auth + Connection Manager**
   - **Objective:** Secure WS handshake and connection management.
   - **Dependencies:** Event Bus interface.

3. **Step 117: Strategy Runner Integration**
   - **Objective:** Emit events from `StrategyRunner` via `EventPublisher`.
   - **Dependencies:** Event Bus.

4. **Step 118: Frontend Client Architecture**
   - **Objective:** Create `WebSocketProvider` and hooks for connection management.
   - **Dependencies:** Backend WS endpoint.

5. **Step 119: Subscription Logic & Integration**
   - **Objective:** Frontend-initiated subscriptions and backend topic routing.
   - **Dependencies:** WebSocket infrastructure, Frontend Client.

6. **Step 120: Market Data Streaming Adapter**
   - **Objective:** Abstract market data streaming.
   - **Dependencies:** Event Bus, WS infrastructure.

7. **Step 121: Production Scaling (Redis)**
   - **Objective:** Migrate event bus to Redis Pub/Sub for multi-worker support.
   - **Dependencies:** All previous steps.
