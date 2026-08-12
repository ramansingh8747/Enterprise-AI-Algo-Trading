# Strategy REST API Contract
> **Version:** 1.0
> **Status:** NEW — Not part of previous frozen contracts
> **Step:** 13.21I.34.110.A
> **Date:** August 11, 2026

---

> **CONTRACT NOTICE**
>
> This document is the authoritative API contract for the Strategy CRUD REST API.
> It does NOT modify or supersede:
> - `docs/api/frontend_api_contract.md` (FROZEN — unchanged)
> - `docs/api/paper_portfolio_api_contract.md` (FROZEN — unchanged)

---

## 1. Overview & Security Boundary

The Strategy REST API exposes the server-side Strategy Engine to authenticated users.
It manages strategy definitions (templates) and strategy instances (deployed runners).

### Key Rules

- **Authentication Required:** All endpoints require `Authorization: Bearer <access_token>`.
- **Server-Enforced Ownership:** All queries are scoped by `user_id` from JWT. Cross-user access returns `404`.
- **PAPER Default:** New strategy instances default to `execution_mode: "PAPER"`.
- **No Order Placement:** This API manages lifecycle only. Orders flow exclusively through `StrategyRunner → BrokerOrderService → RiskEngine`.
- **Kill Switch:** Starting or resuming an instance is blocked when `kill_switch_active = True`.
- **Zero Credential Exposure:** Responses never contain `api_key`, `api_secret`, `access_token`, `password`, or any authorization token.
- **Decimal Precision:** `quantity` and `price` fields in signal responses serialize as fixed-precision Decimal strings.

---

## 2. Base URL

| Environment | Base URL |
| :--- | :--- |
| Development | `http://localhost:8000/api/v1` |
| Production | `https://<domain>/api/v1` |

---

## 3. Authentication

```
Authorization: Bearer <access_token>
```

All strategy endpoints return `401 Unauthorized` if the token is missing or invalid.

---

## 4. Error Response Format

All error responses use the project standard format:

```json
{
  "success": false,
  "message": "<human-readable error message>",
  "data": null
}
```

---

## 5. Lifecycle FSM

```
DRAFT    → READY, STOPPED
READY    → RUNNING, STOPPED
RUNNING  → PAUSED, STOPPED, FAILED
PAUSED   → RUNNING, STOPPED
STOPPED  → READY, DRAFT
FAILED   → STOPPED, DRAFT
```

Invalid transitions return `400 Bad Request`.

**Start endpoint:** Accepts `DRAFT` or `READY` state; promotes `DRAFT → READY → RUNNING` automatically.

---

## 6. Endpoints Summary

| Method | Path | Description | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/strategies` | Create strategy definition | Yes |
| `GET` | `/strategies` | List user's strategy definitions | Yes |
| `GET` | `/strategies/{def_id}` | Get strategy definition | Yes |
| `PUT` | `/strategies/{def_id}` | Update strategy definition | Yes |
| `DELETE` | `/strategies/{def_id}` | Delete strategy definition | Yes |
| `POST` | `/strategies/{def_id}/instances` | Create strategy instance | Yes |
| `GET` | `/strategies/{def_id}/instances` | List strategy instances | Yes |
| `POST` | `/strategies/{def_id}/instances/{inst_id}/start` | Start instance | Yes |
| `POST` | `/strategies/{def_id}/instances/{inst_id}/stop` | Stop instance | Yes |
| `POST` | `/strategies/{def_id}/instances/{inst_id}/pause` | Pause instance | Yes |
| `POST` | `/strategies/{def_id}/instances/{inst_id}/resume` | Resume instance | Yes |
| `GET` | `/strategies/{def_id}/instances/{inst_id}/signals` | Signal history | Yes |

---

## 7. Endpoint Specifications

### 7.1 Create Strategy Definition

`POST /api/v1/strategies`

#### Request Body
```json
{
  "name": "Momentum Breakout Strategy",
  "strategy_type": "DETERMINISTIC_MOMENTUM",
  "config_json": "{\"threshold\": 1.5}"
}
```

| Field | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `name` | string | Yes | — | Strategy name (1–255 chars) |
| `strategy_type` | string | No | `"DETERMINISTIC_MOMENTUM"` | Strategy type identifier |
| `config_json` | string | No | `null` | JSON-encoded config parameters |

#### Response `201 Created`
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "user_id": "8414d052-cd4c-4cf8-9ea0-1526ecb32c16",
  "name": "Momentum Breakout Strategy",
  "strategy_type": "DETERMINISTIC_MOMENTUM",
  "config_json": "{\"threshold\": 1.5}",
  "is_active": true,
  "created_at": "2026-08-11T09:00:00Z",
  "updated_at": "2026-08-11T09:00:00Z"
}
```

#### Error Codes
| Code | Condition |
| :--- | :--- |
| `401` | Missing or invalid JWT |
| `422` | Missing `name` or validation error |

---

### 7.2 List Strategy Definitions

`GET /api/v1/strategies`

Returns all definitions owned by the authenticated user, ordered newest-first.

#### Response `200 OK`
```json
[
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "user_id": "8414d052-cd4c-4cf8-9ea0-1526ecb32c16",
    "name": "Momentum Breakout Strategy",
    "strategy_type": "DETERMINISTIC_MOMENTUM",
    "config_json": null,
    "is_active": true,
    "created_at": "2026-08-11T09:00:00Z",
    "updated_at": "2026-08-11T09:00:00Z"
  }
]
```

#### Error Codes
| Code | Condition |
| :--- | :--- |
| `401` | Missing or invalid JWT |

---

### 7.3 Get Strategy Definition

`GET /api/v1/strategies/{def_id}`

#### Response `200 OK`
Same schema as Create response.

#### Error Codes
| Code | Condition |
| :--- | :--- |
| `401` | Missing or invalid JWT |
| `404` | Definition not found or belongs to another user |

---

### 7.4 Update Strategy Definition

`PUT /api/v1/strategies/{def_id}`

Partial update — only provided fields are changed.

#### Request Body (all optional)
```json
{
  "name": "Updated Strategy Name",
  "strategy_type": "DETERMINISTIC_MOMENTUM",
  "config_json": "{\"threshold\": 2.0}",
  "is_active": false
}
```

#### Response `200 OK`
Updated `StrategyDefinitionResponse`.

#### Error Codes
| Code | Condition |
| :--- | :--- |
| `401` | Missing or invalid JWT |
| `404` | Definition not found or belongs to another user |
| `422` | Validation error |

---

### 7.5 Delete Strategy Definition

`DELETE /api/v1/strategies/{def_id}`

Permanently deletes the definition and cascades to all instances and signals.

#### Response `204 No Content`

#### Error Codes
| Code | Condition |
| :--- | :--- |
| `401` | Missing or invalid JWT |
| `404` | Definition not found or belongs to another user |

---

### 7.6 Create Strategy Instance

`POST /api/v1/strategies/{def_id}/instances`

#### Request Body
```json
{
  "broker_id": "9c3db2fe-7e1a-4a4c-8c3b-5e1f23a4d5c6",
  "execution_mode": "PAPER"
}
```

| Field | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `broker_id` | UUID | Yes | — | Broker account UUID for execution |
| `execution_mode` | string | No | `"PAPER"` | `"PAPER"` or `"LIVE"` |

New instances always start in `DRAFT` status.

#### Response `201 Created`
```json
{
  "id": "7b2c3d4e-5f6a-7b8c-9d0e-1f2a3b4c5d6e",
  "strategy_definition_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "user_id": "8414d052-cd4c-4cf8-9ea0-1526ecb32c16",
  "broker_id": "9c3db2fe-7e1a-4a4c-8c3b-5e1f23a4d5c6",
  "execution_mode": "PAPER",
  "status": "DRAFT",
  "started_at": null,
  "stopped_at": null,
  "last_execution_at": null,
  "error_message": null,
  "created_at": "2026-08-11T09:00:00Z",
  "updated_at": "2026-08-11T09:00:00Z"
}
```

#### Error Codes
| Code | Condition |
| :--- | :--- |
| `401` | Missing or invalid JWT |
| `404` | Definition not found or belongs to another user |
| `422` | Missing `broker_id` or invalid `execution_mode` |

---

### 7.7 List Strategy Instances

`GET /api/v1/strategies/{def_id}/instances`

Returns all instances for the definition, ordered newest-first.

#### Response `200 OK`
Array of `StrategyInstanceResponse` (see 7.6 schema).

#### Error Codes
| Code | Condition |
| :--- | :--- |
| `401` | Missing or invalid JWT |
| `404` | Definition not found or belongs to another user |

---

### 7.8 Start Strategy Instance

`POST /api/v1/strategies/{def_id}/instances/{inst_id}/start`

Transitions the instance to `RUNNING` status.

- Accepts instances in `DRAFT` (auto-promotes to `READY` first) or `READY` state.
- **Blocked** if `kill_switch_active` is `True`.

#### Response `200 OK`
Updated `StrategyInstanceResponse` with `status: "RUNNING"`.

#### Error Codes
| Code | Condition |
| :--- | :--- |
| `400` | Invalid lifecycle transition or kill switch active |
| `401` | Missing or invalid JWT |
| `404` | Definition or instance not found / cross-user access |

---

### 7.9 Stop Strategy Instance

`POST /api/v1/strategies/{def_id}/instances/{inst_id}/stop`

Transitions `RUNNING | PAUSED | READY → STOPPED`.

#### Response `200 OK`
Updated `StrategyInstanceResponse` with `status: "STOPPED"`.

#### Error Codes
| Code | Condition |
| :--- | :--- |
| `400` | Invalid lifecycle transition (e.g. STOPPED → STOPPED) |
| `401` | Missing or invalid JWT |
| `404` | Definition or instance not found / cross-user access |

---

### 7.10 Pause Strategy Instance

`POST /api/v1/strategies/{def_id}/instances/{inst_id}/pause`

Transitions `RUNNING → PAUSED`.

#### Response `200 OK`
Updated `StrategyInstanceResponse` with `status: "PAUSED"`.

#### Error Codes
| Code | Condition |
| :--- | :--- |
| `400` | Invalid lifecycle transition |
| `401` | Missing or invalid JWT |
| `404` | Definition or instance not found / cross-user access |

---

### 7.11 Resume Strategy Instance

`POST /api/v1/strategies/{def_id}/instances/{inst_id}/resume`

Transitions `PAUSED → RUNNING`.

- **Blocked** if `kill_switch_active` is `True`.

#### Response `200 OK`
Updated `StrategyInstanceResponse` with `status: "RUNNING"`.

#### Error Codes
| Code | Condition |
| :--- | :--- |
| `400` | Invalid lifecycle transition or kill switch active |
| `401` | Missing or invalid JWT |
| `404` | Definition or instance not found / cross-user access |

---

### 7.12 Strategy Signal History

`GET /api/v1/strategies/{def_id}/instances/{inst_id}/signals`

Returns signal execution history for a strategy instance, ordered newest-first.

#### Query Parameters

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `limit` | integer | `100` | Max signals returned (1–500) |

#### Response `200 OK`
```json
[
  {
    "id": "aabbccdd-1122-3344-5566-778899aabbcc",
    "strategy_instance_id": "7b2c3d4e-5f6a-7b8c-9d0e-1f2a3b4c5d6e",
    "symbol": "RELIANCE",
    "side": "BUY",
    "quantity": "10.0000",
    "order_type": "MARKET",
    "price": "2500.5000",
    "signal_fingerprint": "a3f8c2d1e4b7f0a9...",
    "status": "EXECUTED",
    "created_at": "2026-08-11T09:01:00Z"
  }
]
```

**Note:** `quantity` and `price` are Decimal strings — never floats.

#### Error Codes
| Code | Condition |
| :--- | :--- |
| `401` | Missing or invalid JWT |
| `404` | Definition or instance not found / cross-user access |

---

## 8. PAPER / LIVE Safety

| Behaviour | Rule |
| :--- | :--- |
| Default `execution_mode` | Always `"PAPER"` |
| Valid modes | `"PAPER"` or `"LIVE"` only |
| Order execution | NEVER via Strategy API — only via `StrategyRunner.execute_cycle()` |
| Kill switch check | Enforced at `start` and `resume` endpoints |
| RiskEngine | Enforced inside `StrategyRunner` for all LIVE cycles |
| Paper isolation | `StrategyRunner` PAPER path never calls `BrokerOrderService` |

---

## 9. Ownership Guarantee

| Resource | Enforcement |
| :--- | :--- |
| StrategyDefinition | All queries filter `WHERE user_id = <jwt_user_id>` |
| StrategyInstance | Ownership verified via definition ownership + instance `user_id` |
| StrategySignal | Ownership verified via instance ownership |
| Cross-user response | `404 Not Found` (never `403 Forbidden`) |

---

## 10. Contract Stability

This contract covers the initial release of the Strategy CRUD REST API.

Future contract extensions (WebSocket streaming, scheduler triggers, analytics) will be
documented as separate additive contracts and must not break this document.
