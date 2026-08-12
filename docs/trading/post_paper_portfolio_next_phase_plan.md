# STEP 13.21I.34.110 — POST-AUDIT NEXT-PHASE IMPLEMENTATION PLAN

> **Step:** 13.21I.34.110
> **Type:** PLANNING ONLY — No Code Changes
> **Date:** August 11, 2026
> **Source Audit:** `docs/trading/post_paper_portfolio_architecture_audit.md` (Step 13.21I.34.109)
> **Code Changes:** ZERO
> **Status:** PLANNING COMPLETE

---

## 1. Executive Summary

This document converts the findings from Step 13.21I.34.109 — Post-Paper-Portfolio Architecture
Audit into a precise, dependency-aware implementation roadmap.

The audit confirmed that the platform's paper trading foundation is complete and production-safe.
The primary architectural gap blocking further automation progress is the **missing Strategy CRUD
REST API** — the HTTP layer that exposes the already-implemented backend strategy engine
(`StrategyRunner`, `StrategyRepository`, `StrategyDefinition`, `StrategyInstance`) to the
frontend and operators.

The recommended immediate next step is:
> **STEP 13.21I.34.110.A — Strategy CRUD REST API (Backend)**

This step has no unresolved architectural ambiguity, depends entirely on completed foundations,
carries no live trading risk, and is independently implementable without touching any existing
frozen contract.

---

## 2. 34.109 Audit Findings

All findings are extracted verbatim from `docs/trading/post_paper_portfolio_architecture_audit.md`.

### 2.1 Completed Capabilities

| Capability | Evidence |
| :--- | :--- |
| Authentication & Authorization | JWT, refresh tokens, protected routes, 401 interceptor |
| Broker Management (CRUD) | Full CRUD endpoints + frontend client |
| Broker Sessions | Session expiry, ownership enforcement |
| Broker Data (Read-Only) | Holdings, positions, orders, quotes, profile |
| Live Order Execution | BUY/SELL/Modify/Cancel + 2-step modal |
| Order Idempotency | `X-Idempotency-Key`, atomic DB deduplication |
| Risk Engine | Kill switch, max quantity/notional, position limits, frequency, daily loss |
| Paper Strategy Execution | `StrategyRunner.execute_cycle()` PAPER mode → `PaperAccountingService` |
| Paper Portfolio Accounting | Average price, cost basis, realized P&L, FIFO |
| Paper Portfolio Valuation | Unrealized P&L, stale quote guard (10s fail-closed) |
| Paper Portfolio REST API | 5 endpoints, ownership-enforced, Decimal serialization |
| Paper Portfolio Frontend UI | `PortfolioPage.tsx`, `paperPortfolioApi.ts`, 3/3 tests pass |
| Strategy Engine Infrastructure | `StrategyDefinition`, `StrategyInstance`, `StrategySignal` ORM models |
| Strategy Repository | `get_instance_for_user`, `update_instance_status`, `create_signal_if_not_exists` |
| Strategy Signal Deduplication | SHA-256 fingerprint + DB unique constraint |
| Strategy Stale Data Guard | 10s max age, fail-closed |
| Strategy Lifecycle FSM | DRAFT→READY→RUNNING→PAUSED→STOPPED→FAILED |
| Frontend API Clients | authApi, brokersApi, brokerSessionsApi, brokerDataApi, brokerOrdersApi, paperPortfolioApi |
| Database Migrations | 8 Alembic migrations, 12 tables |
| Financial Decimal Precision | SQL NUMERIC(18,4), Python Decimal, string JSON serialization |
| Security & Credential Isolation | Zero api_key/api_secret/access_token in any response |

### 2.2 Partial Capabilities

| Capability | Gap |
| :--- | :--- |
| Market Data | Only REST polling (no WebSocket, no historical) |
| Strategy Frontend UI | `StrategyPage.tsx` renders mock client-side signals only (GAP-005) |
| Deployment Hardening | Secrets from env OK; TLS/Docker/Gunicorn/CORS missing (GAP-004) |

### 2.3 Missing Capabilities

| ID | Gap | Severity |
| :--- | :--- | :--- |
| GAP-001 | Strategy CRUD REST API | CRITICAL |
| GAP-002 | Background Worker / APScheduler | CRITICAL |
| GAP-003 | Broker Session Auto-Refresh for workers | CRITICAL |
| GAP-004 | Deployment Hardening | CRITICAL |
| GAP-005 | Strategy Frontend Management UI | HIGH |
| GAP-006 | Strategy API Client (`strategyApi.ts`) | HIGH |
| GAP-007 | Emergency Kill Switch Admin UI | HIGH |
| GAP-008 | Cash & Buying Power enforcement in PaperPortfolio | HIGH |
| GAP-009 | WebSocket Quote Streaming | HIGH |
| GAP-010 | System Observability (APM/Tracing) | MEDIUM |
| GAP-011 | Admin/Operations Tools | MEDIUM |
| GAP-012 | CORS Production Origin Restriction | MEDIUM |
| GAP-013 | Daily Loss Circuit Breaker Admin Notification | MEDIUM |
| GAP-014 | Dashboard Server-Backed Data | MEDIUM |
| GAP-015 | Historical Market Data API | LOW |
| GAP-016 | Backtesting Engine | LOW |
| GAP-017 | Trading Journal Backend Persistence | LOW |
| GAP-018 | Watchlist Backend Persistence | LOW |
| GAP-019 | Structured JSON Logging | LOW |

---

## 3. Completed Foundation (Verified Against Actual Codebase)

The following was verified by direct inspection of source files during Step 13.21I.34.110 planning:

### Backend Services Verified

| Component | File | Verification |
| :--- | :--- | :--- |
| `StrategyDefinition` ORM | `backend/app/database/models/strategy.py:12` | `user_id`, `name`, `strategy_type`, `config_json`, `is_active` |
| `StrategyInstance` ORM | `backend/app/database/models/strategy.py:39` | `strategy_definition_id`, `broker_id`, `execution_mode`, `status`, `started_at`, `stopped_at` |
| `StrategySignal` ORM | `backend/app/database/models/strategy.py:76` | `signal_fingerprint` unique constraint per instance |
| `StrategyRepository` | `backend/app/database/repositories/strategy_repository.py` | `get_instance_for_user`, `update_instance_status`, `create_signal_if_not_exists` |
| `StrategyRunner` | `backend/app/services/strategy_engine/strategy_runner.py` | Full paper/live execution loop, stale guard, deduplication |
| `DeterministicMomentumStrategy` | `backend/app/services/strategy_engine/base_strategy.py` | Concrete strategy implementation |
| Lifecycle FSM | `strategy_repository.py:14-21` | `VALID_LIFECYCLE_TRANSITIONS` dict |
| `api.py` router | `backend/app/api/api.py` | Strategy router **NOT YET registered** (confirmed) |

### Frontend Verified

| Component | File | Status |
| :--- | :--- | :--- |
| `StrategyPage.tsx` | `frontend/src/pages/strategy/StrategyPage.tsx` | 172 lines; uses `signalService.ts` mock only |
| `signalService.ts` | `frontend/src/services/signals/signalService.ts` | Client-side `mode: "MOCK"` — no API call |
| `strategyApi.ts` | `frontend/src/services/api/` | **DOES NOT EXIST** (confirmed) |

### API Registration Verified

`backend/app/api/api.py` currently registers 8 routers:
- health, auth, users, brokers, broker_sessions, broker_data, broker_orders, paper_portfolios
- **Strategy router: NOT REGISTERED** (confirmed gap)

---

## 4. Remaining Capability Matrix

| Capability | Status | Priority | Depends On |
| :--- | :--- | :--- | :--- |
| Strategy CRUD REST API | MISSING | P1 | ORM models (DONE), StrategyRepository (DONE) |
| Strategy Pydantic Schemas | MISSING | P1 | Strategy ORM models (DONE) |
| Strategy API Client (frontend) | MISSING | P1 | Strategy REST API |
| Strategy Frontend Management UI | PROTOTYPE | P1 | Strategy API Client |
| Cash & Buying Power Enforcement | MISSING | P2 | PaperPortfolio model (DONE) |
| Background Worker / Scheduler | MISSING | P2 | Strategy REST API, Broker Session Auto-Refresh |
| Broker Session Auto-Refresh | MISSING | P2 | Broker session model (DONE) |
| WebSocket Quote Streaming | MISSING | P2 | Background worker infrastructure |
| Kill Switch Admin UI | MISSING | P2 | Risk Engine (DONE) |
| System Observability | MISSING | P3 | Deployment Hardening |
| Admin Operations Tools | MISSING | P3 | Kill Switch UI |
| Deployment Hardening | PARTIAL | P3 | — |
| Historical Market Data | MISSING | P3 | — |
| Backtesting Engine | MISSING | P3 | Historical Market Data |
| Trading Journal Backend | MISSING | P3 | — |
| Watchlist Backend | MISSING | P3 | — |

---

## 5. Priority Matrix

### P0 — Critical Safety / Blocker (No items — safety foundation complete)

All P0 items (authentication, idempotency, risk engine, paper isolation) are **COMPLETE**.

### P1 — Required Foundation

| Item | Rationale |
| :--- | :--- |
| Strategy CRUD REST API | Unlocks strategy management from the frontend; required before any scheduled automation |
| Strategy Pydantic Schemas | Required by Strategy REST API implementation |
| Strategy API Client (`strategyApi.ts`) | Required for frontend strategy management |
| Strategy Frontend Management UI | Required for users to create/start/stop strategies without direct DB access |

### P2 — High-Value Capability

| Item | Rationale |
| :--- | :--- |
| Cash & Buying Power enforcement | Makes paper trading financially realistic; enforces virtual balance constraints |
| Background Worker / Scheduler | Enables automated, periodic `StrategyRunner.execute_cycle()` without manual calls |
| Broker Session Auto-Refresh | Required to keep long-running strategies alive beyond session expiry |
| Kill Switch Admin UI | Makes the existing kill switch toggle accessible without direct DB manipulation |
| WebSocket Quote Streaming | Required for sub-second quote updates in live automated strategies |

### P3 — Optimization / Future Enhancement

| Item | Rationale |
| :--- | :--- |
| System Observability | Required before production deployment; non-blocking for staging |
| Admin Operations Tools | Required for multi-user production; non-blocking for early rollout |
| Deployment Hardening (TLS, Docker, Gunicorn) | Required for public internet deployment |
| Historical Market Data | Required only for backtesting, not for live/paper |
| Backtesting Engine | Future optimization; depends on historical data |
| Trading Journal Backend | Convenience feature; does not block trading |
| Watchlist Backend | Convenience feature; does not block trading |
| Structured JSON Logging | Observability improvement; non-blocking |

---

## 6. Dependency Graph

```
[COMPLETED FOUNDATIONS]
  StrategyDefinition ORM ─────────────────┐
  StrategyInstance ORM ────────────────────┤
  StrategySignal ORM ──────────────────────┤
  StrategyRepository ──────────────────────┤──► [P1] Strategy CRUD REST API
  StrategyRunner ──────────────────────────┤        (Schemas + Router + api.py registration)
  RiskEngine ──────────────────────────────┤              │
  PaperAccountingService ──────────────────┤              │
  PaperPortfolioRepository ───────────────-┘              │
                                                          │
                              [P1] Strategy API Client (strategyApi.ts) ◄──┤
                                          │
                              [P1] Strategy Frontend Management UI ◄───────┘
                                          │
                   ┌──────────────────────┴──────────────────────┐
                   │                                              │
         [P2] Background Scheduler                    [P2] Cash & Buying Power
         (APScheduler + session auto-refresh)         (PaperPortfolio.available_cash)
                   │
         [P2] WebSocket Quote Streaming
                   │
         [P3] Live Automated Strategies
                   │
         [P3] Deployment Hardening → [P3] Observability → [P3] Admin Tools
```

### Critical Path to Live Automated Strategy Execution:

```
GAP-001 (Strategy REST API)
  → GAP-006 (strategyApi.ts)
  → GAP-005 (Strategy Frontend UI)
  → GAP-002 (Background Scheduler)
  → GAP-003 (Session Auto-Refresh)
  → LIVE AUTOMATED STRATEGIES ENABLED
```

---

## 7. Recommended Immediate Next Step

### Selected: **STEP 13.21I.34.110.A — Strategy CRUD REST API (Backend)**

#### Why This Step

1. **Architecture dependency:** All downstream steps (strategy frontend, background scheduler, live automation) depend on the Strategy REST API existing. It is the single highest-leverage unblocking action.
2. **All prerequisites are complete:** `StrategyDefinition`, `StrategyInstance`, `StrategySignal` ORM models, `StrategyRepository` with lifecycle FSM, `StrategyRunner`, Alembic migration — all exist and are tested.
3. **No speculative design:** The domain model is fully defined. The implementation pattern is proven (follow `paper_portfolios.py` as the reference).
4. **Zero live trading risk:** Paper mode is the default. The REST API exposes strategy lifecycle management, not direct order execution.
5. **Clear scope boundaries:** 8 endpoints with clear request/response schemas, no new database tables, no migration required.
6. **No contract conflicts:** The Strategy API is a **new** API surface. Frozen `frontend_api_contract.md` and `paper_portfolio_api_contract.md` are unaffected.

---

## 8. Detailed Next-Step Scope: STEP 13.21I.34.110.A

### 8.1 Step Title
**Strategy CRUD REST API — Backend**

### 8.2 Objective
Implement the HTTP API layer that exposes the existing backend strategy engine
(`StrategyDefinition`, `StrategyInstance`, `StrategyRepository`) to authenticated users
as a RESTful API, enabling strategy creation, instance management, lifecycle control
(start/stop/pause), and signal history retrieval from the frontend and operator tools.

### 8.3 Problem Being Solved

The `StrategyRunner`, `StrategyRepository`, `StrategyDefinition`, and `StrategyInstance` ORM
models are fully implemented and tested. However, there are **zero HTTP endpoints** exposing
them. Users cannot create, list, start, stop, or inspect strategies without direct database access.

Without this API, the frontend `StrategyPage.tsx` cannot transition from mock client-side signal
generation to server-backed strategy management.

### 8.4 Current State

| Component | Current State |
| :--- | :--- |
| `StrategyDefinition` ORM | EXISTS — `backend/app/database/models/strategy.py` |
| `StrategyInstance` ORM | EXISTS — `backend/app/database/models/strategy.py` |
| `StrategySignal` ORM | EXISTS — `backend/app/database/models/strategy.py` |
| `StrategyRepository` | EXISTS — `backend/app/database/repositories/strategy_repository.py` |
| `StrategyRunner` | EXISTS — `backend/app/services/strategy_engine/strategy_runner.py` |
| Strategy Pydantic Schemas | **MISSING** |
| Strategy FastAPI Router | **MISSING** |
| Strategy Router Registration | **NOT IN `api.py`** |
| Strategy API Client (frontend) | **MISSING** |

### 8.5 Target State

After this step:
- `backend/app/schemas/strategy.py` — Pydantic request/response schemas defined
- `backend/app/api/v1/routes/strategies.py` — FastAPI router with 9 endpoints
- `backend/app/api/api.py` — Strategy router registered
- `backend/app/dependencies/strategy.py` — FastAPI dependency injection for StrategyRepository
- `backend/app/tests/test_strategy_api.py` — Pytest test suite covering all endpoints
- All existing tests continue to pass (177+N passed / 1 pre-existing failure)

Frontend scope is **deferred to Step 13.21I.34.111**.

### 8.6 Backend Scope

#### New Files to Create

| File | Purpose |
| :--- | :--- |
| `backend/app/schemas/strategy.py` | Pydantic request/response schemas |
| `backend/app/api/v1/routes/strategies.py` | FastAPI router with all 9 endpoints |
| `backend/app/dependencies/strategy.py` | DI factory for `StrategyRepository` |
| `backend/app/tests/test_strategy_api.py` | Pytest integration test suite |

#### Files to Modify

| File | Change |
| :--- | :--- |
| `backend/app/api/api.py` | Register strategy router |

#### API Endpoints to Implement

| Method | Path | Description | Request Schema | Response Schema |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/strategies` | Create strategy definition | `StrategyDefinitionCreateRequest` | `StrategyDefinitionResponse` (201) |
| `GET` | `/strategies` | List user strategy definitions | — | `List[StrategyDefinitionResponse]` (200) |
| `GET` | `/strategies/{def_id}` | Get strategy definition | — | `StrategyDefinitionResponse` (200) |
| `PUT` | `/strategies/{def_id}` | Update strategy definition | `StrategyDefinitionUpdateRequest` | `StrategyDefinitionResponse` (200) |
| `DELETE` | `/strategies/{def_id}` | Delete strategy definition | — | 204 No Content |
| `POST` | `/strategies/{def_id}/instances` | Create strategy instance | `StrategyInstanceCreateRequest` | `StrategyInstanceResponse` (201) |
| `GET` | `/strategies/{def_id}/instances` | List instances for definition | — | `List[StrategyInstanceResponse]` (200) |
| `POST` | `/strategies/{def_id}/instances/{inst_id}/start` | Start instance (→ RUNNING) | — | `StrategyInstanceResponse` (200) |
| `POST` | `/strategies/{def_id}/instances/{inst_id}/stop` | Stop instance (→ STOPPED) | — | `StrategyInstanceResponse` (200) |
| `POST` | `/strategies/{def_id}/instances/{inst_id}/pause` | Pause instance (→ PAUSED) | — | `StrategyInstanceResponse` (200) |
| `GET` | `/strategies/{def_id}/instances/{inst_id}/signals` | Get signal history for instance | — | `List[StrategySignalResponse]` (200) |

#### Pydantic Schemas to Define

**Requests:**
- `StrategyDefinitionCreateRequest`: `name` (str, required), `strategy_type` (str, default `DETERMINISTIC_MOMENTUM`), `config_json` (Optional[str])
- `StrategyDefinitionUpdateRequest`: `name` (Optional[str]), `strategy_type` (Optional[str]), `config_json` (Optional[str]), `is_active` (Optional[bool])
- `StrategyInstanceCreateRequest`: `broker_id` (UUID, required), `execution_mode` (str, default `PAPER`)

**Responses:**
- `StrategyDefinitionResponse`: `id`, `user_id`, `name`, `strategy_type`, `config_json`, `is_active`, `created_at`, `updated_at`
- `StrategyInstanceResponse`: `id`, `strategy_definition_id`, `user_id`, `broker_id`, `execution_mode`, `status`, `started_at`, `stopped_at`, `last_execution_at`, `error_message`, `created_at`, `updated_at`
- `StrategySignalResponse`: `id`, `strategy_instance_id`, `symbol`, `side`, `quantity` (Decimal string), `order_type`, `price` (Optional Decimal string), `signal_fingerprint`, `status`, `created_at`

### 8.7 Frontend Scope

**NONE for this step.** Frontend API client and UI management are deferred to Step 13.21I.34.111.

`StrategyPage.tsx` and `signalService.ts` remain unchanged in this step.

### 8.8 Database Scope

**NO NEW TABLES.** No Alembic migration required.

All required tables already exist:
- `strategy_definitions` (Step 13.21I.34.100 migration)
- `strategy_instances` (Step 13.21I.34.100 migration)
- `strategy_signals` (Step 13.21I.34.100 migration)

New repository methods may be added to `strategy_repository.py` if needed (e.g., `list_definitions_for_user`, `get_definition_for_user`, `create_definition`). These are repository additions, not database schema changes.

### 8.9 API Scope

A **new API contract document** must be created:

`docs/api/strategy_api_contract.md`

This documents the new Strategy REST API surface.

**Frozen contracts remain unchanged:**
- `docs/api/frontend_api_contract.md` — **UNCHANGED**
- `docs/api/paper_portfolio_api_contract.md` — **UNCHANGED**

The strategy API is an **additive new API surface** that does not modify any existing endpoint.

### 8.10 Security Scope

| Requirement | Implementation |
| :--- | :--- |
| Authentication | All strategy endpoints must use `Depends(get_current_active_user)` |
| User Isolation | All queries must scope by `user_id` from JWT — users can only access their own strategies |
| Execution Mode Safety | Strategy instance creation must default to `execution_mode: "PAPER"` |
| LIVE mode restriction | When `execution_mode: "LIVE"` is specified, an active broker session must be verified |
| Zero credential exposure | No `api_key`, `api_secret`, `access_token` in any response |
| No cross-user access | All `strategy_definitions` and `strategy_instances` queries filter by `user_id` |
| Definition ownership before instance | Instances can only be created for definitions owned by the authenticated user |

### 8.11 Financial Safety Scope

| Requirement | Status |
| :--- | :--- |
| Paper/Live isolation | Strategy instances with `execution_mode: "PAPER"` must never invoke `BrokerOrderService` directly via the HTTP API — only via `StrategyRunner` (which enforces isolation) |
| No direct order placement via Strategy API | The Strategy REST API manages lifecycle (create/start/stop) only. Orders flow exclusively through `StrategyRunner → BrokerOrderService` (which enforces `RiskEngine`) |
| Decimal precision | All `quantity` and `price` fields in `StrategySignalResponse` must serialize as fixed Decimal strings |
| Kill switch compatibility | Starting a strategy instance when `kill_switch_active = True` must be rejected (check `TradingRiskSettings`) |
| Stale data guard | Strategy API does not run execution cycles; stale guard remains in `StrategyRunner` |
| Risk engine boundary | Strategy API does not bypass risk engine. Execution is always via `StrategyRunner` |

### 8.12 Testing Scope

#### Backend Tests to Create (`backend/app/tests/test_strategy_api.py`)

| Test | Description |
| :--- | :--- |
| 1. Create strategy definition | POST /strategies returns 201 with correct schema |
| 2. List strategy definitions | GET /strategies returns only authenticated user's definitions |
| 3. Get strategy definition by ID | GET /strategies/{id} returns 200 or 404 for foreign |
| 4. Update strategy definition | PUT /strategies/{id} updates name/config |
| 5. Delete strategy definition | DELETE /strategies/{id} returns 204 |
| 6. Create strategy instance | POST /strategies/{id}/instances returns 201 PAPER mode default |
| 7. List strategy instances | GET /strategies/{id}/instances scoped by definition ownership |
| 8. Start strategy instance | POST .../start transitions DRAFT→READY→RUNNING |
| 9. Stop strategy instance | POST .../stop transitions to STOPPED |
| 10. Pause strategy instance | POST .../pause transitions RUNNING→PAUSED |
| 11. Invalid lifecycle transition | Returns 400 on invalid transition |
| 12. Signal history retrieval | GET .../signals returns list for owned instance |
| 13. Cross-user isolation | User B cannot access User A's definitions or instances (404) |
| 14. Unauthenticated access | 401 for all endpoints without JWT |
| 15. Create instance with LIVE mode | Requires active broker session |
| 16. Zero credential exposure | No api_key/api_secret in any response |

#### Existing Test Baseline (Must Not Regress)

| Suite | Baseline |
| :--- | :--- |
| Backend Pytest | 177 pass / 1 fail (AngelOne stub — unchanged) |
| Frontend Vitest | 98 pass / 0 fail |
| TypeScript Check | PASS (0 errors) |
| ESLint | PASS (0 errors) |
| Production Build | PASS |

### 8.13 Documentation Scope

| Document | Action |
| :--- | :--- |
| `docs/api/strategy_api_contract.md` | **CREATE** — new Strategy API contract |
| `docs/trading/strategy_rest_api_implementation.md` | **CREATE** — implementation summary |
| `docs/trading/post_paper_portfolio_next_phase_plan.md` | This document (planning complete) |

### 8.14 Explicit Out-of-Scope Items for Step 13.21I.34.110.A

The following are explicitly excluded from this step:

| Out of Scope | Reason |
| :--- | :--- |
| Frontend `strategyApi.ts` API client | Deferred to Step 13.21I.34.111 |
| `StrategyPage.tsx` UI redesign | Deferred to Step 13.21I.34.111 |
| Background scheduler / APScheduler | Deferred to Step 13.21I.34.112 |
| Cash & Buying Power enforcement | Deferred to Step 13.21I.34.113 |
| WebSocket streaming | Not in current priority phase |
| New broker integrations | No broker changes needed |
| Live automated execution loop | Not safe until background scheduler implemented |
| Any change to frozen API contracts | Frozen contracts must remain unchanged |
| Any change to existing migrations | No new tables; no migration needed |
| Any change to RiskEngine | RiskEngine is complete and tested |
| Any change to PaperAccountingService | No accounting changes needed |
| Any change to BrokerOrderService | No broker order changes needed |
| Emergency Kill Switch Admin UI | Deferred to Step 13.21I.34.114 |
| Deployment hardening | Deferred to Step 13.21I.34.115 |
| Backtesting engine | P3 — future phase |
| Historical market data | P3 — future phase |
| Structured logging | P3 — future phase |

### 8.15 Dependencies

| Dependency | Status |
| :--- | :--- |
| `StrategyDefinition` ORM model | COMPLETE |
| `StrategyInstance` ORM model | COMPLETE |
| `StrategySignal` ORM model | COMPLETE |
| `StrategyRepository` with lifecycle FSM | COMPLETE |
| Strategy Alembic migration (tables exist) | COMPLETE |
| `get_current_active_user` dependency | COMPLETE |
| `TradingRiskRepository` (for kill switch check) | COMPLETE |
| Reference pattern: `paper_portfolios.py` router | COMPLETE |
| Reference pattern: `PaperPortfolioRepository` | COMPLETE |

### 8.16 Acceptance Criteria

1. `POST /strategies` creates a `StrategyDefinition` owned by the authenticated user
2. `GET /strategies` returns only the authenticated user's definitions (not other users')
3. `GET /strategies/{id}` returns 404 if the definition belongs to another user
4. `PUT /strategies/{id}` updates name, config_json, is_active fields
5. `DELETE /strategies/{id}` permanently removes the definition and cascades to instances
6. `POST /strategies/{id}/instances` creates a `StrategyInstance` in `DRAFT` state, defaulting to `execution_mode: "PAPER"`
7. `POST .../start` transitions READY→RUNNING; returns 400 if transition is invalid
8. `POST .../stop` transitions any active state→STOPPED
9. `POST .../pause` transitions RUNNING→PAUSED
10. `GET .../signals` returns `StrategySignal` records for the owned instance, ordered by `created_at` desc
11. All strategy endpoints return 401 if JWT is missing or invalid
12. No `api_key`, `api_secret`, or `access_token` appears in any response body
13. All financial fields in `StrategySignalResponse` (`quantity`, `price`) serialize as Decimal strings
14. Backend pytest suite: **≥ (177+N) passed / 1 pre-existing AngelOne failure** (N = new tests)
15. Frontend Vitest suite: **98 passed / 0 failed** (no regression)
16. TypeScript check: **0 errors**
17. Production build: **PASS**
18. Frozen API contracts: **UNCHANGED**
19. `docs/api/strategy_api_contract.md` created and accurate

### 8.17 Rollback Considerations

This step involves only:
- New Python files (schemas, route, dependency, tests)
- One line added to `api.py` (router include)
- No database schema changes

**Rollback:** Removing the strategy router registration from `api.py` and deleting the 4 new files fully reverts the change. No database rollback needed.

---

## 9. Testing Strategy

### Backend Testing

```bash
# Run the new strategy API test suite in isolation
pytest backend/app/tests/test_strategy_api.py -v

# Run full regression suite to confirm no regressions
pytest backend/ -v
# Expected: (177+N) passed / 1 failed (AngelOne pre-existing)
```

### Frontend Testing (No changes — regression verification only)

```bash
cd frontend
npx vitest run
# Expected: 98 passed / 0 failed

npx tsc --noEmit
# Expected: 0 errors

npm run lint
# Expected: 0 errors

npm run build
# Expected: clean dist/ bundle
```

---

## 10. Security Requirements

| Requirement | Implementation Note |
| :--- | :--- |
| JWT auth on all endpoints | `Depends(get_current_active_user)` on router |
| `user_id` scoped queries | All DB queries filter by `current_user.id` |
| 404 (not 403) for foreign resources | Do not reveal existence of other users' strategies |
| PAPER mode default | `execution_mode` defaults to `"PAPER"` in `StrategyInstanceCreateRequest` |
| LIVE mode gating | LIVE mode instance creation requires verifiable active broker session |
| Zero credential exposure | Strategy schemas must not include any broker credential fields |
| Strategy definition ownership gate | Users cannot create instances for another user's definition |

---

## 11. Financial Safety Requirements

| Requirement | Enforcement Point |
| :--- | :--- |
| No order placement via Strategy REST API | Strategy API manages lifecycle only — no order routing |
| Kill switch respected on start | Check `TradingRiskSettings.kill_switch_active` before transitioning to RUNNING |
| Risk engine remains mandatory | Execution via `StrategyRunner` which enforces `RiskEngine.validate_order()` |
| Paper/live isolation | PAPER instances cannot invoke live broker SDK via the strategy lifecycle API |
| Decimal precision | `quantity` and `price` in signal response serialized as strings |
| Stale data guard | Remains in `StrategyRunner`; strategy API does not run cycles |
| Signal deduplication | Remains in `StrategyRunner`; strategy API does not generate signals |

---

## 12. API / Contract Requirements

### New Contract to Create
`docs/api/strategy_api_contract.md` — documents all 11 new endpoints with request/response schemas.

### Existing Frozen Contracts — UNCHANGED
- `docs/api/frontend_api_contract.md` — **MUST REMAIN UNCHANGED**
- `docs/api/paper_portfolio_api_contract.md` — **MUST REMAIN UNCHANGED**

### API Design Principles (to follow for new strategy contract)
- All endpoints under `/api/v1/strategies`
- All require `Authorization: Bearer <token>`
- `execution_mode` is validated: only `"PAPER"` or `"LIVE"` accepted
- Lifecycle transition errors return `400 Bad Request` with clear message
- Cross-user access returns `404 Not Found` (not 403)
- Financial fields serialize as strings (Decimal-safe)

---

## 13. Out-of-Scope (Step 13.21I.34.110.A)

| Item | Deferred To |
| :--- | :--- |
| Frontend `strategyApi.ts` | Step 13.21I.34.111 |
| `StrategyPage.tsx` backend integration | Step 13.21I.34.111 |
| Background scheduler (APScheduler) | Step 13.21I.34.112 |
| Broker session auto-refresh | Step 13.21I.34.112 |
| Cash & Buying Power enforcement | Step 13.21I.34.113 |
| Kill Switch Admin UI | Step 13.21I.34.114 |
| Admin/Operations Dashboard | Step 13.21I.34.114 |
| Deployment hardening | Step 13.21I.34.115 |
| WebSocket streaming | Post Step 13.21I.34.115 |
| Historical market data | Post Step 13.21I.34.115 |
| Backtesting Engine | Future phase |
| Observability (APM/Tracing) | Future phase |

---

## 14. Future Roadmap

Based on the dependency graph and priority classification:

| Step | Title | Priority | Depends On |
| :--- | :--- | :--- | :--- |
| **13.21I.34.110.A** | Strategy CRUD REST API (Backend) | **P1** | DONE foundations |
| **13.21I.34.111** | Strategy API Client & Frontend Management UI | **P1** | Step 110.A |
| **13.21I.34.112** | Background Worker Scheduler & Session Auto-Refresh | **P2** | Steps 110.A + 111 |
| **13.21I.34.113** | Cash & Buying Power Accounting | **P2** | PaperPortfolio model (DONE) |
| **13.21I.34.114** | Admin Operations UI (Kill Switch, Risk Settings) | **P2** | Steps 110.A + 111 |
| **13.21I.34.115** | Deployment Hardening (Docker, TLS, Gunicorn) | **P3** | Step 114 |
| **13.21I.34.116+** | Live Automated Strategy Gate | **P3** | Steps 112 + 113 + 115 |

---

## 15. Risks

| Risk | Severity | Mitigation |
| :--- | :--- | :--- |
| Strategy lifecycle FSM conflicts | LOW | `StrategyRepository.update_instance_status()` already enforces valid transitions; HTTP API delegates directly |
| LIVE mode accidentally enabled | MEDIUM | Default `execution_mode: "PAPER"`; LIVE requires active broker session validation |
| Cross-user data leakage | MEDIUM | All queries must filter by `user_id` from JWT; validated by cross-user isolation tests |
| Kill switch bypass at API start | LOW | Include kill switch check in start endpoint before transition to RUNNING |
| Signal schema financial precision | LOW | Use `str` type serialization for `quantity`/`price` in Pydantic schema |
| Regression to existing test suites | LOW | Run full pytest + vitest before marking step complete |
| api.py duplicate registration | LOW | Single `include_router` call; FastAPI will raise startup error on duplicate prefix |

---

## 16. Final Recommendation

```
==================================================
STEP 13.21I.34.110 — PLANNING COMPLETE
CODE CHANGES: ZERO
==================================================

RECOMMENDED IMMEDIATE NEXT STEP:
  STEP 13.21I.34.110.A — Strategy CRUD REST API (Backend)

WHY:
  1. All ORM models, migrations, repository, and runner are DONE
  2. Zero unresolved architectural ambiguity
  3. No live trading risk (paper default)
  4. No existing contract changes
  5. No database schema changes
  6. Unblocks all downstream strategy automation work
  7. Independent — safe to implement without changing any existing code

CRITICAL PATH:
  GAP-001 (This step)
    → GAP-006 (strategyApi.ts — Step 111)
    → GAP-005 (Strategy Frontend UI — Step 111)
    → GAP-002 (Scheduler — Step 112)
    → GAP-003 (Session Auto-Refresh — Step 112)
    → LIVE AUTOMATED STRATEGIES

FROZEN CONTRACTS: UNCHANGED
PAPER PORTFOLIO CONTRACT: UNCHANGED
EXISTING TESTS: NO REGRESSION
==================================================
```
