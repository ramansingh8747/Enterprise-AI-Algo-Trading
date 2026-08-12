# PAPER PORTFOLIO API CONTRACT
> **NEW — NOT PART OF PREVIOUS FROZEN CONTRACT**
>
> Authoritative Backend REST API Contract for the Paper Portfolio Subsystem.

---

## 1. Overview & Security Boundary
The Paper Portfolio API exposes server-side paper position, accounting, valuation, and summary metrics.

### Key Rules:
- **Strictly PAPER Execution:** All endpoints filter by and enforce `execution_mode == "PAPER"`.
- **Server-Enforced User Ownership:** Identity is derived exclusively from the authenticated JWT token (`get_current_active_user`). Client-provided user identity forge attempts are rejected with `404 Not Found`.
- **Zero Credential Exposure:** Responses NEVER contain `api_key`, `api_secret`, `access_token`, `password`, or authorization tokens.
- **Decimal Financial Precision:** All financial values (`quantity`, `average_price`, `cost_basis`, `realized_pnl`, `unrealized_pnl`, `total_pnl`) serialize as fixed Decimal strings.

---

## 2. Endpoints Summary

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/paper-portfolios` | List all PAPER portfolios for current user | Yes |
| `POST` | `/api/v1/paper-portfolios` | Initialize or create a PAPER portfolio | Yes |
| `GET` | `/api/v1/paper-portfolios/{portfolio_id}` | Get specific PAPER portfolio details | Yes |
| `GET` | `/api/v1/paper-portfolios/{portfolio_id}/positions` | Get open/closed positions for portfolio | Yes |
| `GET` | `/api/v1/paper-portfolios/{portfolio_id}/summary` | Get portfolio P&L & valuation summary | Yes |

---

## 3. Endpoint Specifications

### 3.1 List Paper Portfolios
`GET /api/v1/paper-portfolios`

#### Response (`200 OK`):
```json
[
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "user_id": "8414d052-cd4c-4cf8-9ea0-1526ecb32c16",
    "strategy_instance_id": null,
    "name": "Default Paper Portfolio",
    "execution_mode": "PAPER",
    "created_at": "2026-08-11T08:00:00Z",
    "updated_at": "2026-08-11T08:00:00Z"
  }
]
```

---

### 3.2 Create / Initialize Paper Portfolio
`POST /api/v1/paper-portfolios`

#### Request Payload:
```json
{
  "name": "Strategy Paper Account",
  "strategy_instance_id": "d3b07384-d113-460a-4c8b-000000000001"
}
```

#### Response (`201 Created`):
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "user_id": "8414d052-cd4c-4cf8-9ea0-1526ecb32c16",
  "strategy_instance_id": "d3b07384-d113-460a-4c8b-000000000001",
  "name": "Strategy Paper Account",
  "execution_mode": "PAPER",
  "created_at": "2026-08-11T08:00:00Z",
  "updated_at": "2026-08-11T08:00:00Z"
}
```

---

### 3.3 Get Paper Portfolio Details
`GET /api/v1/paper-portfolios/{portfolio_id}`

#### Response (`200 OK`):
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "user_id": "8414d052-cd4c-4cf8-9ea0-1526ecb32c16",
  "strategy_instance_id": null,
  "name": "Default Paper Portfolio",
  "execution_mode": "PAPER",
  "created_at": "2026-08-11T08:00:00Z",
  "updated_at": "2026-08-11T08:00:00Z"
}
```

#### Error Response (`404 Not Found`):
```json
{
  "detail": "Paper portfolio 3fa85f64-5717-4562-b3fc-2c963f66afa6 not found or not accessible."
}
```

---

### 3.4 Get Paper Positions
`GET /api/v1/paper-portfolios/{portfolio_id}/positions?include_closed=false`

#### Query Parameters:
- `include_closed` (boolean, default: `false`): If `false`, returns only positions with `quantity > 0.0000`.

#### Response (`200 OK`):
```json
[
  {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "paper_portfolio_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "user_id": "8414d052-cd4c-4cf8-9ea0-1526ecb32c16",
    "strategy_instance_id": null,
    "symbol": "RELIANCE",
    "quantity": "10.0000",
    "average_price": "2500.0000",
    "cost_basis": "25000.0000",
    "realized_pnl": "100.0000",
    "unrealized_pnl": "500.0000",
    "created_at": "2026-08-11T08:00:00Z",
    "updated_at": "2026-08-11T08:05:00Z"
  }
]
```

---

### 3.5 Get Paper Portfolio Summary
`GET /api/v1/paper-portfolios/{portfolio_id}/summary`

#### Response (`200 OK`):
```json
{
  "paper_portfolio_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "user_id": "8414d052-cd4c-4cf8-9ea0-1526ecb32c16",
  "execution_mode": "PAPER",
  "total_realized_pnl": "150.0000",
  "total_unrealized_pnl": "350.0000",
  "total_pnl": "500.0000",
  "position_count": 1,
  "updated_at": "2026-08-11T08:05:00Z"
}
```
