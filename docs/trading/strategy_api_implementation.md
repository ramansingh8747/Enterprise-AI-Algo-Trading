# Strategy CRUD REST API Implementation (`Step 13.21I.34.110.A`)

## 1. Objective

Implement the HTTP API layer that exposes the existing backend strategy engine
(`StrategyDefinition`, `StrategyInstance`, `StrategySignal`, `StrategyRepository`,
`StrategyRunner`) to authenticated users as a RESTful API.

This closes **GAP-001** identified in `docs/trading/post_paper_portfolio_architecture_audit.md`.

---

## 2. Architecture

```
[POST|GET|PUT|DELETE /api/v1/strategies/...]
    │
    ▼
[JWT Authentication (get_current_active_user)]
    │
    ▼
[strategies.py Router]
    │
    ├── Definition CRUD → StrategyRepository.{create,list,get,update,delete}_definition()
    ├── Instance CRUD   → StrategyRepository.{create,list}_instance()
    ├── Lifecycle       → StrategyRepository.update_instance_status()
    │                     + TradingRiskRepository.get_risk_settings() (kill switch)
    └── Signal History  → StrategyRepository.list_signals_for_instance()
```

**No order placement occurs via this API.** Orders flow exclusively through:
`StrategyRunner.execute_cycle() → BrokerOrderService → RiskEngine → Broker SDK`

---

## 3. Endpoints Implemented

| Method | Path | Description | HTTP Code |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/strategies` | Create strategy definition | 201 |
| `GET` | `/api/v1/strategies` | List user's definitions | 200 |
| `GET` | `/api/v1/strategies/{def_id}` | Get definition | 200 |
| `PUT` | `/api/v1/strategies/{def_id}` | Update definition | 200 |
| `DELETE` | `/api/v1/strategies/{def_id}` | Delete definition | 204 |
| `POST` | `/api/v1/strategies/{def_id}/instances` | Create instance | 201 |
| `GET` | `/api/v1/strategies/{def_id}/instances` | List instances | 200 |
| `POST` | `/api/v1/strategies/{def_id}/instances/{inst_id}/start` | Start (→ RUNNING) | 200 |
| `POST` | `/api/v1/strategies/{def_id}/instances/{inst_id}/stop` | Stop (→ STOPPED) | 200 |
| `POST` | `/api/v1/strategies/{def_id}/instances/{inst_id}/pause` | Pause (→ PAUSED) | 200 |
| `POST` | `/api/v1/strategies/{def_id}/instances/{inst_id}/resume` | Resume (→ RUNNING) | 200 |
| `GET` | `/api/v1/strategies/{def_id}/instances/{inst_id}/signals` | Signal history | 200 |

---

## 4. Authentication

All endpoints require `Authorization: Bearer <access_token>` via `Depends(get_current_active_user)`.

Missing or invalid tokens return `401 Unauthorized`.

---

## 5. Authorization & Ownership

All queries filter by `user_id` from the JWT:
- `StrategyDefinition` queries: `WHERE user_id = <jwt_user_id>`
- `StrategyInstance` queries: `WHERE user_id = <jwt_user_id>`
- `StrategySignal` queries: `WHERE user_id = <jwt_user_id>`
- Cross-user access returns `404 Not Found` (not `403`)

---

## 6. Lifecycle Safety

The lifecycle FSM is enforced by the existing `StrategyRepository.update_instance_status()`:
```
VALID_LIFECYCLE_TRANSITIONS = {
    "DRAFT":   ["READY", "STOPPED"],
    "READY":   ["RUNNING", "STOPPED"],
    "RUNNING": ["PAUSED", "STOPPED", "FAILED"],
    "PAUSED":  ["RUNNING", "STOPPED"],
    "STOPPED": ["READY", "DRAFT"],
    "FAILED":  ["STOPPED", "DRAFT"],
}
```

Invalid transitions raise `InvalidLifecycleTransitionException` → HTTP `400 Bad Request`.

**Start endpoint special behaviour:** Accepts `DRAFT` state by auto-promoting `DRAFT → READY → RUNNING`.

---

## 7. PAPER / LIVE Safety

| Guarantee | Implementation |
| :--- | :--- |
| PAPER default | `StrategyInstanceCreateRequest.execution_mode` defaults to `"PAPER"` |
| Valid modes only | 422 returned for any mode other than `"PAPER"` or `"LIVE"` |
| Kill switch on start | `TradingRiskRepository.get_risk_settings()` checked before start/resume |
| Kill switch blocks | 400 returned with `"kill switch"` in message |
| No order placement | Strategy API delegates to `StrategyRunner` — never calls `BrokerOrderService` directly |
| RiskEngine preserved | All order execution via `StrategyRunner → BrokerOrderService → RiskEngine` |

---

## 8. Signal History

`GET /api/v1/strategies/{def_id}/instances/{inst_id}/signals`

- Read-only endpoint.
- Ownership of both definition and instance verified.
- `quantity` and `price` fields serialize as fixed-precision Decimal strings.
- Default limit: 100 signals; max: 500.
- No new signal execution mechanism created.

---

## 9. Error Handling

| HTTP Code | Condition |
| :--- | :--- |
| `401` | Missing or invalid JWT |
| `400` | Invalid lifecycle transition, kill switch active |
| `404` | Definition/instance not found or cross-user access |
| `422` | Request validation error (missing name, invalid execution_mode) |

Error response format:
```json
{"success": false, "message": "<description>", "data": null}
```

---

## 10. Security

| Requirement | Status |
| :--- | :--- |
| Zero `api_key` in responses | VERIFIED — 3 credential exposure tests pass |
| Zero `api_secret` in responses | VERIFIED |
| Zero `access_token` in responses | VERIFIED |
| Zero `password` in responses | VERIFIED |
| JWT auth on all endpoints | VERIFIED — 2 unauthenticated tests pass |
| User isolation | VERIFIED — 5 cross-user isolation tests pass |
| 404 for cross-user resources | VERIFIED |

---

## 11. Files Created / Modified

### Created
| File | Purpose |
| :--- | :--- |
| `backend/app/schemas/strategy.py` | Pydantic schemas for Definition, Instance, Signal |
| `backend/app/api/v1/routes/strategies.py` | FastAPI router — 12 endpoints |
| `backend/app/tests/api/v1/test_strategy_api.py` | 45 integration tests |
| `docs/api/strategy_api_contract.md` | New API contract |
| `docs/trading/strategy_api_implementation.md` | This document |

### Modified
| File | Change |
| :--- | :--- |
| `backend/app/database/repositories/strategy_repository.py` | Added CRUD methods: `create_definition`, `list_definitions_for_user`, `get_definition_for_user`, `update_definition`, `delete_definition`, `create_instance`, `list_instances_for_definition`, `list_signals_for_instance` |
| `backend/app/api/api.py` | Registered `strategies_router` (1 import + 1 include_router line) |

### Unchanged (verified)
| File | Status |
| :--- | :--- |
| `docs/api/frontend_api_contract.md` | UNCHANGED |
| `docs/api/paper_portfolio_api_contract.md` | UNCHANGED |
| All existing routers | UNCHANGED |
| All existing tests | UNCHANGED |
| RiskEngine | UNCHANGED |
| StrategyRunner | UNCHANGED |
| PaperAccountingService | UNCHANGED |
| Database models | UNCHANGED |
| Alembic migrations | UNCHANGED |

---

## 12. Testing

### Strategy API Test Suite

**File:** `backend/app/tests/api/v1/test_strategy_api.py`
**Result:** 45 passed / 0 failed

| Category | Tests |
| :--- | :--- |
| Authentication (401) | 2 |
| Definition Create | 3 |
| Definition List | 2 |
| Definition Get | 2 |
| Definition Update | 2 |
| Definition Delete | 2 |
| Instance Create / PAPER default | 5 |
| Instance List | 2 |
| Lifecycle Start | 3 |
| Lifecycle Pause | 2 |
| Lifecycle Resume | 2 |
| Lifecycle Stop | 3 |
| Invalid Lifecycle Transition | 1 |
| Signal History | 3 |
| Cross-User Isolation | 5 |
| Kill Switch Enforcement | 2 |
| Decimal Serialization | 1 |
| Credential Exposure | 3 |

### Full Backend Regression
**Result:** 222 passed / 1 failed (pre-existing AngelOne stub — unchanged)

### Baseline Before Step
177 passed / 1 failed

### Delta
+45 new tests, all pass.

---

## 13. Contract Verification

Verified `docs/api/strategy_api_contract.md` against actual implementation:

| Contract Claim | Verified |
| :--- | :--- |
| 12 endpoints at correct paths/methods | VERIFIED |
| 201 on definition create | VERIFIED |
| 201 on instance create | VERIFIED |
| 204 on definition delete | VERIFIED |
| 200 on lifecycle transitions | VERIFIED |
| 401 on unauthenticated access | VERIFIED |
| 404 on cross-user access | VERIFIED |
| 400 on invalid lifecycle transition | VERIFIED |
| 400 on kill switch | VERIFIED |
| 422 on missing name | VERIFIED |
| 422 on invalid execution_mode | VERIFIED |
| Decimal string serialization in signals | VERIFIED |
| Zero credential exposure | VERIFIED |

---

## 14. Remaining Gaps

The following gaps identified in Step 13.21I.34.109 remain open after this step:

| Gap | Status | Next Step |
| :--- | :--- | :--- |
| GAP-005 — Strategy Frontend Management UI | OPEN | Step 13.21I.34.111 |
| GAP-006 — `strategyApi.ts` frontend client | OPEN | Step 13.21I.34.111 |
| GAP-002 — Background Scheduler | OPEN | Step 13.21I.34.112 |
| GAP-003 — Session Auto-Refresh | OPEN | Step 13.21I.34.112 |
| GAP-008 — Cash & Buying Power | OPEN | Step 13.21I.34.113 |
| GAP-007 — Kill Switch Admin UI | OPEN | Step 13.21I.34.114 |
| GAP-004 — Deployment Hardening | OPEN | Step 13.21I.34.115 |
