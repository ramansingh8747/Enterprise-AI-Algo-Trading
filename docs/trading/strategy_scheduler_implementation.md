# Background Strategy Execution Scheduler & Worker Infrastructure (`Step 13.21I.34.123 — GAP-002 & GAP-003`)

## 1. Objective

Implement backend background worker & scheduler service (`StrategySchedulerService`) to periodically query active `RUNNING` strategy instances and execute `StrategyRunner.execute_cycle()` with full error isolation, kill switch compliance, stale quote guards, and session auto-refresh.

---

## 2. Architecture & Data Flow

```
[StrategySchedulerService (Background Loop)]
                     │
                     ▼
  [RiskEngine.is_kill_switch_active()] ─── (HALT cycle if Active)
                     │
                     ▼
  [StrategyRepository.get_all_running_instances()]
                     │
                     ▼
    ┌────────────────┴────────────────┐
    ▼                                 ▼
[Instance 1 (PAPER)]               [Instance 2 (LIVE)]
    │                                 │
    │                      [broker.refresh_session()] (GAP-003)
    │                                 │
    ▼                                 ▼
[StrategyRunner.execute_cycle()] ──► [StrategyRunner.execute_cycle()]
    │                                 │
    ▼                                 ▼
[Signal Generation & Deduplication] [BrokerOrderService & RiskEngine]
    │                                 │
    └────────────────┬────────────────┘
                     ▼
  [EventBus.publish("strategy:<id>")]
                     │
                     ▼
    [WebSocket / ConnectionManager]
```

---

## 3. Core Technical Features

### 3.1 Strategy Scheduler Service (`backend/app/services/strategy_engine/strategy_scheduler.py`)
- **`StrategySchedulerService`:** Background worker class maintaining async cycle execution loop with configurable interval (default 5.0 seconds).
- **Kill Switch Safety Gate:** Verifies `RiskEngine.is_kill_switch_active()` prior to cycle execution. Skips execution safely if Kill Switch is engaged.
- **Failure Isolation:** Executes each strategy instance in an isolated try-except block so an exception in one instance does not affect other instances or crash the worker loop.
- **Broker Session Auto-Refresh (GAP-003):** Automatically refreshes broker session tokens for `LIVE` execution mode instances prior to cycle execution.
- **Observability Summary:** Returns detailed execution summary containing cycle count, timestamp, running instance count, successful vs failed execution counts, and instance details.

### 3.2 Repository Query Extensions (`backend/app/database/repositories/strategy_repository.py`)
- Added `get_all_running_instances()` query method returning all `StrategyInstance` records across the system currently in `"RUNNING"` state.

### 3.3 Dependency Injection (`backend/app/dependencies/strategy.py`)
- Added `get_strategy_scheduler_service` dependency factory.

---

## 4. Verification & Test Results

### 4.1 Backend Test Suite (`backend/app/tests/services/test_strategy_scheduler.py`)
- **Result:** 15 passed / 0 failed
- **Combined Real-Time & Scheduler Test Suite:** 78 passed / 0 failed
- **Full Backend Pytest Suite:** 328 passed / 3 failed (3 pre-existing environment Fernet key failures)
- Tests covered: Scheduler start/stop lifecycle, periodic cycle execution for RUNNING instances, ignoring DRAFT/PAUSED/STOPPED instances, Kill Switch integration, multi-instance concurrent execution, failure isolation, EventBus event publishing on `strategy:<instance_id>` topics, Decimal string preservation, stale quote guard enforcement, session auto-refresh for LIVE mode instances, user isolation, PAPER vs LIVE mode handling, clean shutdown without task leaks, credential isolation in summary, and ConnectionManager integration.

---

## 5. Security & Boundary Rules

- **Zero Credential Exposure:** Scheduler summaries and logs verify zero exposure of `api_key`, `secret_key`, `access_token`, `feed_token`, or `jwt`.
- **REST & DB Integrity:** REST API contract and database schemas remain unchanged.
- **PAPER/LIVE Isolation:** Strategy instances execute strictly in their configured mode (`PAPER` or `LIVE`).
