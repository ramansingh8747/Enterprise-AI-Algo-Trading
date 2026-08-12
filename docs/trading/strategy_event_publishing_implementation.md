# StrategyRunner Event Publishing & Real-Time Strategy Events Implementation (`Step 13.21I.34.117`)

## 1. Objective

Integrate the server-side `StrategyRunner` with the existing `EventBus` (`EventPublisher`) infrastructure so that strategy lifecycle transitions and execution signals are published in real time.

---

## 2. Architecture & Design Principles

```
  [Strategy Lifecycle Action / Execution Cycle]
                      │
                      ▼
            [StrategyRunner]
            ┌─────────┴─────────┐
            │  State Change /   │ (Guaranteed Execution)
            │ Trading Fill DB   │
            └─────────┬─────────┘
                      │
                      ▼ (Fail-Safe Publishing)
               [_publish_event()]
                      │
                      ▼
             [Async EventBus]
                      │
                      ▼
         [WebSocket ConnectionManager]
```

### Safety & Isolation Guarantees

1. **Observational Infrastructure:** Event publication is strictly an observational notification layer. If `EventBus.publish()` fails, times out, or drops an event due to backpressure (`QueueFull`), the underlying strategy execution, RiskEngine evaluation, order idempotency, and DB state transitions **continue safely without error**.
2. **User Isolation:** All events carry `user_id` extracted from authenticated requests/instances. Events are published to topic `strategy:<strategy_instance_id>`.
3. **PAPER / LIVE Mode Isolation:** Events preserve `execution_mode` metadata (`"PAPER"` or `"LIVE"`). PAPER events are never represented as LIVE.
4. **Zero Credential Leakage:** Event envelopes and payload dictionaries NEVER contain `api_key`, `api_secret`, `access_token`, `password`, `jwt`, or authorization headers.

---

## 3. Event Types & Emission Points

| Event Type | Topic Format | Trigger Point in StrategyRunner | Payload Fields |
| :--- | :--- | :--- | :--- |
| `instance.started` | `strategy:<instance_id>` | `start_instance()` after DB state set to RUNNING | `status`, `previous_status` |
| `instance.paused` | `strategy:<instance_id>` | `pause_instance()` after DB state set to PAUSED | `status`, `previous_status` |
| `instance.resumed` | `strategy:<instance_id>` | `resume_instance()` after DB state set to RUNNING | `status`, `previous_status` |
| `instance.stopped` | `strategy:<instance_id>` | `stop_instance()` after DB state set to STOPPED | `status`, `previous_status` |
| `instance.failed` | `strategy:<instance_id>` | `mark_instance_failed()` after DB state set to FAILED | `status`, `previous_status`, `error_message` |
| `signal.generated` | `strategy:<instance_id>` | `execute_cycle()` after DB deduplication check passes | `signal_id`, `side`, `quantity`, `order_type`, `price`, `signal_fingerprint` |
| `signal.executed` | `strategy:<instance_id>` | `execute_cycle()` after PAPER simulation or LIVE fill succeeds | `signal_id`, `order_id`, `status`, `side`, `quantity`, `price` |
| `signal.rejected` | `strategy:<instance_id>` | `execute_cycle()` when LIVE order execution fails / RiskEngine rejects | `signal_id`, `reason`, `side`, `quantity` |

---

## 4. Canonical Event Envelope

All published events construct a validated `Event` model:

```json
{
  "event_id": "8414d052-cd4c-4cf8-9ea0-1526ecb32c16",
  "event_type": "signal.executed",
  "timestamp": "2026-08-11T12:50:00Z",
  "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "strategy_id": "7b2c3d4e-5f6a-7b8c-9d0e-1f2a3b4c5d6e",
  "strategy_instance_id": "9c3db2fe-7e1a-4a4c-8c3b-5e1f23a4d5c6",
  "broker_id": "11223344-5566-7788-9900-aabbccddeeff",
  "symbol": "RELIANCE",
  "execution_mode": "PAPER",
  "payload": {
    "signal_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "order_id": "PAPER-a1b2c3d4e5f6",
    "status": "COMPLETE",
    "side": "BUY",
    "quantity": "10",
    "price": "2500.0000"
  }
}
```

---

## 5. Fail-Safe Event Publication Logic

Inside `StrategyRunner`:

```python
def _publish_event(self, event_type, user_id, strategy_instance_id, ...):
    if not self._event_publisher:
        return
    try:
        event = Event(...)
        topic = Topic.strategy(strategy_instance_id)

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            loop.create_task(self._async_publish(topic, event))
        else:
            asyncio.run(self._async_publish(topic, event))
    except Exception as exc:
        logger.warning("Event publishing failed: %s", exc)
```

`_async_publish` catches all exceptions raised by `EventPublisher.publish()`, ensuring zero uncaught exceptions escape to trading execution logic.

---

## 6. Testing Summary

**Test Suite:** `backend/app/tests/services/test_strategy_runner_events.py`
**Result:** 14 passed / 0 failed

| Test Case | Description | Result |
| :--- | :--- | :--- |
| `test_instance_started_event_published` | Verifies `instance.started` published on start | PASS |
| `test_instance_paused_event_published` | Verifies `instance.paused` published on pause | PASS |
| `test_instance_resumed_event_published` | Verifies `instance.resumed` published on resume | PASS |
| `test_instance_stopped_event_published` | Verifies `instance.stopped` published on stop | PASS |
| `test_instance_failed_event_published` | Verifies `instance.failed` published on failure mark | PASS |
| `test_signal_generated_and_executed_paper_events` | Verifies `signal.generated` and `signal.executed` in PAPER mode | PASS |
| `test_signal_executed_live_event` | Verifies `signal.executed` in LIVE mode | PASS |
| `test_signal_rejected_live_event` | Verifies `signal.rejected` on RiskEngine rejection in LIVE mode | PASS |
| `test_user_id_and_instance_id_correctness` | Validates `user_id` and `strategy_instance_id` envelope fields | PASS |
| `test_credential_isolation_in_events` | Asserts no secret keys in event payloads | PASS |
| `test_event_publication_failure_does_not_break_execution` | Confirms execution succeeds when publisher raises exception | PASS |
| `test_event_ordering_for_lifecycle_transitions` | Verifies correct chronological event sequence | PASS |
| `test_no_event_published_for_invalid_transition` | Verifies no event emitted on invalid FSM transition | PASS |
| `test_no_duplicate_events_per_lifecycle_action` | Confirms exactly 1 event emitted per state transition | PASS |

---

## 7. Remaining Gaps

- **STEP 13.21I.34.118:** Frontend WebSocket client integration (`useWebSocketSubscription`).
- **Market Data Streaming:** Real-time quote publishing to `market:<symbol>` topics.
- **Multi-Worker Bus:** In-memory `asyncio.Queue` bus to be upgraded to Redis Pub/Sub for horizontal scaling when multi-process deployment is needed.
