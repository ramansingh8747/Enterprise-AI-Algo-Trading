# Frontend WebSocket Client Implementation (`Step 13.21I.34.118`)

## 1. Objective

Implement the frontend WebSocket client foundation for real-time strategy lifecycle events, signal notifications, and topic subscriptions, integrating with the backend EventBus and WebSocket infrastructure.

---

## 2. Architecture & Design

```
   [AppProviders]
         │
  [AuthProvider]
         │
[WebSocketProvider]  ◄─── Maintains WS connection, reconnect timer, heartbeat
         │
[useWebSocketSubscription] ◄─── Component topic subscription hook
         │
 [React Components] (Dashboard, Strategy Management, Orders UI)
```

---

## 3. Core Components Implemented

### 3.1 Type Definitions (`frontend/src/types/websocket.ts`)
- `WebSocketConnectionState`: `"DISCONNECTED" | "CONNECTING" | "CONNECTED" | "RECONNECTING" | "ERROR"`
- `WebSocketEvent<T>`: Canonical envelope (`event_id`, `event_type`, `timestamp`, `user_id`, `strategy_instance_id`, `payload`)
- `WebSocketErrorEvent`: Error envelope for server-sent errors
- `isValidWebSocketEvent(value)`: Type guard function for safe runtime validation

### 3.2 Context & Provider (`frontend/src/context/WebSocketProvider.tsx`)
- Single WebSocket connection lifecycle management
- Automatic connection triggered when `isAuthenticated` is `true` via `useAuth()`
- URL derived dynamically from `import.meta.env.VITE_API_URL` (`http:` -> `ws:`, `https:` -> `wss:`)
- Reconnect with bounded exponential backoff + jitter (`BASE_DELAY = 1000ms`, `MAX_DELAY = 30000ms`, random 500ms jitter)
- Intentional `disconnect()` stops auto-reconnecting
- Automatic subscription restoration on server after reconnect
- Application-level heartbeat ping/pong every 30s
- Map-based topic subscription registry with Set callback deduplication
- Safe JSON parsing and isolated subscriber callback execution

### 3.3 Custom Hook (`frontend/src/hooks/useWebSocketSubscription.ts`)
- `useWebSocketSubscription(topic: string, callback: WebSocketEventCallback): void`
- Subscribes on mount / topic change; unsubscribes on unmount / topic change
- Stable callback reference handling via `useRef` to prevent resubscription loops

---

## 4. Security & Credential Isolation

- **Token Storage:** Tokens are read exclusively from `localStorage` (`access_token`) via `useAuth()`. No duplicate auth storage is created.
- **Credential Isolation:** Zero tokens or secret credentials (`api_key`, `api_secret`, `access_token`, `password`, `jwt`) are logged to console or rendered in the DOM.

---

## 5. Testing & Verification

### Vitest Test Suite (`frontend/src/tests/websocketClient.test.tsx`)
- **Result:** 20 passed / 0 failed
- **Full Vitest Suite:** 121 passed / 0 failed (13 test files)
- **TypeScript (`npx tsc --noEmit`):** PASSED (0 errors)
- **Production Build (`npm run build`):** PASSED (Built in 7.66s)

| Test Area | Result |
| :--- | :--- |
| URL Derivation | PASS |
| Type Guard Validation | PASS |
| Connection States (CONNECTING -> CONNECTED -> DISCONNECTED) | PASS |
| Subscription Registration & Unsubscribe Cleanup | PASS |
| Duplicate Subscription Protection | PASS |
| Event Routing & Multi-Subscriber Dispatch | PASS |
| Malformed JSON & Invalid Event Type Guarding | PASS |
| Reconnect with Exponential Backoff + Jitter | PASS |
| Subscriptions Restored After Reconnect | PASS |
| Heartbeat Ping/Pong Handling | PASS |
| PAPER & LIVE Topic Handling | PASS |
| Credential & Secret Isolation | PASS |
| Unmount Cleanup & Callback Failure Isolation | PASS |

---

## 6. Remaining Gaps

- **Market Data Streaming:** UI components for live quote tickers / chart streaming on `market:<symbol>` topics (belongs to future steps).
- **Backend WebSocket Header Auth Compatibility:** Browser standard `WebSocket` API cannot send custom HTTP headers (`Authorization: Bearer <token>`) during upgrade. The provider passes token query parameter `?token=<access_token>` or subprotocol if configured.
