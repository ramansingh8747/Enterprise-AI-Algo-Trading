# Frontend API Contract — Enterprise AI Algo Trading Platform

**Version:** 1.0 (Frozen — Step 13.21I.34.82)  
**Status:** ✅ FROZEN — READY FOR FRONTEND INTEGRATION  
**Frozen as of:** Step 13.21I.34.82  
**Previous audit:** Step 13.21I.34.81 (53/53 tests pass)

---

> **IMPORTANT — CONTRACT FREEZE NOTICE**
>
> This document defines the authoritative, frozen API contract between the React/Vite frontend
> and the FastAPI backend.  
> Any breaking change to this contract requires explicit approval before implementation.
>
> **Breaking changes include:**
> - Renaming any endpoint path
> - Changing any HTTP method
> - Removing or renaming any response field
> - Changing any required request field
> - Changing authentication or authorization requirements
> - Changing HTTP status code semantics
> - Changing token contract (structure, expiry, claims)

---

## 1. API Base URL

| Environment | Base URL |
|-------------|----------|
| Development | `http://localhost:8000/api/v1` |
| Production  | `https://<production-domain>/api/v1` |

All endpoint paths in this document are relative to the base URL.

**API prefix** is configured via `API_PREFIX` setting (default: `/api/v1`).  
**OpenAPI docs** available at `GET /api/v1/docs` **only when `DEBUG=True`**.

---

## 2. Authentication

### Scheme

```
Authorization: Bearer <access_token>
```

- Token type: `bearer` (lowercase)
- Algorithm: `HS256`
- Token extraction: `HTTPBearer` scheme (FastAPI)

### JWT Claims (internal — do NOT expose to users)

| Claim | Value |
|-------|-------|
| `sub` | User UUID string |
| `type` | `"access"` or `"refresh"` |
| `jti` | Unique token ID (UUID) |
| `iat` | Issued-at timestamp |
| `exp` | Expiration timestamp |

### Token Lifecycle

| Token | Expiry | Configurable via |
|-------|--------|-----------------|
| Access Token | 30 minutes | `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` |
| Refresh Token | 7 days | `JWT_REFRESH_TOKEN_EXPIRE_DAYS` |

### Frontend Authentication Flow

```
1. POST /auth/register       → Create account (returns UserResponse, no tokens)
2. POST /auth/login          → Authenticate (returns access_token + refresh_token + user)
3. Store access_token        → Client-side (localStorage / in-memory per existing frontend)
4. Add header to all protected requests:
       Authorization: Bearer <access_token>
5. When access_token expires (401):
       POST /auth/refresh { "refresh_token": "<refresh_token>" }
       → Returns new access_token + new refresh_token (token rotation)
6. Store new token pair
7. On refresh failure (401/403):
       Redirect to login
```

---

## 3. Common Headers

| Header | Value | When |
|--------|-------|------|
| `Content-Type` | `application/json` | All POST/PUT requests with body |
| `Authorization` | `Bearer <access_token>` | All protected endpoints |
| `Accept` | `application/json` | Recommended |

---

## 4. Response Envelopes

### Type A — Standard Wrapped Response (Success)

Used by: **auth module** and **brokers module**

```json
{
  "success": true,
  "message": "Human-readable status message",
  "data": { ... }
}
```

### Type B — Direct Pydantic Response

Used by: **users module**, **broker-sessions**, **broker-data**, **broker-orders**

```json
{ ... }
```
or for arrays:
```json
[ ... ]
```

### Type C — No Content

Used by: DELETE endpoints, `PUT /users/change-password`

```
HTTP 204 — Empty body
```

### Error Response (all modules, all conditions)

```json
{
  "success": false,
  "message": "Error description",
  "data": null
}
```

For validation errors (422), `data` contains the error detail list:
```json
{
  "success": false,
  "message": "Validation error",
  "data": [
    { "loc": ["body", "field_name"], "msg": "...", "type": "..." }
  ]
}
```

> **Frontend Note:** The frontend must handle both Type A (wrapped) and Type B (direct) response
> shapes depending on which module is being called. See endpoint matrix below.

---

## 5. Endpoint Matrix

| Module | Method | Endpoint | Auth Required | Role | Response Type | Success Code |
|--------|--------|----------|--------------|------|---------------|-------------|
| Auth | POST | `/auth/register` | No | — | A (Wrapped) | 201 |
| Auth | POST | `/auth/login` | No | — | A (Wrapped) | 200 |
| Auth | POST | `/auth/refresh` | No | — | A (Wrapped) | 200 |
| Auth | GET | `/auth/me` | Bearer | — | A (Wrapped) | 200 |
| Users | GET | `/users/me` | Bearer | — | B (Direct) | 200 |
| Users | PUT | `/users/me` | Bearer | — | B (Direct) | 200 |
| Users | PUT | `/users/change-password` | Bearer | — | C (No Content) | 204 |
| Brokers | POST | `/brokers` | Bearer | ADMIN | A (Wrapped) | 201 |
| Brokers | GET | `/brokers` | Bearer | ADMIN | A (Wrapped) | 200 |
| Brokers | GET | `/brokers/{broker_id}` | Bearer | ADMIN | A (Wrapped) | 200 |
| Brokers | PUT | `/brokers/{broker_id}` | Bearer | ADMIN | A (Wrapped) | 200 |
| Brokers | DELETE | `/brokers/{broker_id}` | Bearer | ADMIN | C (No Content) | 204 |
| Sessions | POST | `/broker-sessions` | Bearer | — | B (Direct) | 201 |
| Sessions | GET | `/broker-sessions/{broker_id}` | Bearer | — | B (Direct) | 200 |
| Sessions | DELETE | `/broker-sessions/{session_id}` | Bearer | — | C (No Content) | 204 |
| Data | GET | `/broker-data/{broker_id}/profile` | Bearer | — | B (Direct) | 200 |
| Data | GET | `/broker-data/{broker_id}/holdings` | Bearer | — | B (Direct Array) | 200 |
| Data | GET | `/broker-data/{broker_id}/positions` | Bearer | — | B (Direct Array) | 200 |
| Data | GET | `/broker-data/{broker_id}/orders` | Bearer | — | B (Direct Array) | 200 |
| Data | GET | `/broker-data/{broker_id}/quotes` | Bearer | — | B (Direct Array) | 200 |
| Orders | POST | `/broker-orders/{broker_id}` | Bearer | — | B (Direct) | 201 |
| Orders | PUT | `/broker-orders/{broker_id}/{order_id}` | Bearer | — | B (Direct) | 200 |
| Orders | POST | `/broker-orders/{broker_id}/{order_id}/cancel` | Bearer | — | B (Direct) | 200 |
| Orders | GET | `/broker-orders/{broker_id}` | Bearer | — | B (Direct Array) | 200 |

---

## 6. Request Schemas

### POST `/auth/register`
```json
{
  "email": "user@example.com",        // required, valid email, normalised to lowercase
  "username": "trader1",              // required, 3-50 chars, alphanumeric + underscore only
  "full_name": "Pro Trader",          // required, 2-255 chars
  "password": "Password123",          // required, min 8 chars, ≥1 uppercase, ≥1 digit
  "role": "TRADER"                    // optional, default: "TRADER". Values: "TRADER" | "ANALYST" | "ADMIN"
}
```

### POST `/auth/login`
```json
{
  "email": "user@example.com",        // required
  "password": "Password123"           // required
}
```

### POST `/auth/refresh`
```json
{
  "refresh_token": "<refresh_jwt>"    // required
}
```

### PUT `/users/me`
```json
{
  "full_name": "New Name",            // optional
  "email": "newemail@example.com"     // optional
}
```

### PUT `/users/change-password`
```json
{
  "old_password": "OldPass123",       // required
  "new_password": "NewPass456"        // required, min 8 chars
}
```

### POST `/brokers` (ADMIN only)
```json
{
  "broker_name": "Zerodha",           // required, 1-255 chars
  "broker_type": "zerodha",           // required, 1-50 chars
  "api_key": "your_api_key",          // required — ONLY sent on create/update, NEVER returned
  "api_secret": "your_api_secret",    // required — ONLY sent on create/update, NEVER returned
  "client_id": "ZB1234",              // optional
  "is_active": true                   // optional, default: true
}
```

### PUT `/brokers/{broker_id}` (ADMIN only)
```json
{
  "broker_name": "Zerodha Pro",       // optional
  "broker_type": "zerodha",           // optional
  "api_key": "new_api_key",           // optional — NEVER returned in response
  "api_secret": "new_api_secret",     // optional — NEVER returned in response
  "client_id": "ZB9999",              // optional
  "is_active": true                   // optional
}
```

### POST `/broker-sessions`
```json
{
  "broker_id": "c2ce3afe-4468-49fc-9278-880111831207",   // required UUID
  "access_token": "<broker_session_token>",               // required — NOT returned in response
  "expires_at": "2025-12-31T23:59:59Z"                   // required ISO 8601 datetime
}
```

### GET `/broker-data/{broker_id}/quotes`
Query parameter (required):
```
?symbols=INFY&symbols=TCS&symbols=RELIANCE
```

### POST `/broker-orders/{broker_id}` — Place Order
```json
{
  "symbol": "INFY",                   // required
  "exchange": "NSE",                  // required
  "quantity": "10",                   // required, decimal > 0
  "side": "BUY",                      // required — "BUY" or "SELL"
  "order_type": "MARKET",             // required — e.g. "LIMIT", "MARKET"
  "product": "CNC",                   // required — e.g. "CNC", "MIS"
  "variety": "regular",               // optional, default: "regular"
  "price": null,                      // optional, decimal ≥ 0
  "trigger_price": null               // optional, decimal ≥ 0
}
```

### PUT `/broker-orders/{broker_id}/{order_id}` — Modify Order
Same fields as Place Order (all required for modify).

### POST `/broker-orders/{broker_id}/{order_id}/cancel` — Cancel Order
Body is optional:
```json
{
  "variety": "regular",               // optional, default: "regular"
  "parent_order_id": null             // optional
}
```

---

## 7. Success Response Schemas

### UserResponse (in `data` for wrapped; direct for `/users/me`)
```json
{
  "id": "uuid-string",
  "email": "user@example.com",
  "username": "trader1",
  "full_name": "Pro Trader",
  "role": "TRADER",
  "is_active": true,
  "is_verified": false,
  "last_login": "2025-01-01T10:00:00Z",   // nullable
  "created_at": "2025-01-01T08:00:00Z",
  "updated_at": "2025-01-01T08:00:00Z"
}
```

### TokenResponse (in `data` after login/refresh)
```json
{
  "access_token": "<jwt_string>",
  "refresh_token": "<jwt_string>",
  "token_type": "bearer",
  "user": { /* UserResponse */ }
}
```

### BrokerResponse (in `data` for broker endpoints)
```json
{
  "id": "uuid-string",
  "broker_name": "Zerodha",
  "broker_type": "zerodha",
  "client_id": "ZB1234",              // nullable
  "is_active": true
}
```
> **SECURITY:** `api_key` and `api_secret` are **intentionally excluded**. Never present in any response.

### BrokerSessionResponse (direct)
```json
{
  "id": "uuid-string",
  "broker_id": "uuid-string",
  "user_id": "uuid-string",
  "expires_at": "2025-12-31T23:59:59Z"
}
```
> **SECURITY:** `access_token` is **intentionally excluded**. Never present in any response.

### BrokerProfile (direct)
```json
{
  "account_id": "ZB1234",
  "account_type": "individual",       // nullable
  "currency": "INR"                   // nullable
}
```

### BrokerHolding (direct array)
```json
{
  "symbol": "INFY",
  "quantity": "10",
  "average_price": "1500.00"          // nullable
}
```

### BrokerPosition (direct array)
```json
{
  "symbol": "RELIANCE",
  "quantity": "5",
  "side": "buy",
  "avg_price": "2800.00"
}
```

### BrokerOrder (direct array — from broker data)
```json
{
  "order_id": "ORD123",
  "symbol": "TCS",
  "side": "BUY",
  "quantity": "10",
  "status": "COMPLETE"
}
```

### BrokerOrderResponse (direct — from broker-orders)
```json
{
  "order_id": "ORD123",
  "symbol": "INFY",
  "side": "BUY",
  "quantity": "10",
  "status": "PENDING"
}
```

### BrokerOrderActionResultResponse (direct — modify/cancel)
```json
{
  "order_id": "ORD123",
  "success": true
}
```

### BrokerQuoteResponse (direct array)
```json
{
  "symbol": "INFY",
  "bid": "1498.50",
  "ask": "1499.00",
  "last_price": "1498.75"
}
```

---

## 8. Error Response Examples

### 401 — No/Invalid/Expired Token
```json
{ "success": false, "message": "Authentication required.", "data": null }
{ "success": false, "message": "The provided token is invalid.", "data": null }
{ "success": false, "message": "The provided token has expired.", "data": null }
```

### 401 — Invalid Credentials
```json
{ "success": false, "message": "Invalid email or password.", "data": null }
```

### 403 — Forbidden (role or inactive)
```json
{ "success": false, "message": "You do not have permission to perform this action.", "data": null }
{ "success": false, "message": "This account has been deactivated. Please contact support.", "data": null }
```

### 404 — Not Found
```json
{ "success": false, "message": "No active session found.", "data": null }
{ "success": false, "message": "Broker with ID '...' not found.", "data": null }
```

### 409 — Conflict (Duplicate Registration)
```json
{ "success": false, "message": "A user with email 'user@example.com' already exists.", "data": null }
```

### 422 — Validation Error
```json
{
  "success": false,
  "message": "Validation error",
  "data": [
    { "loc": ["body", "email"], "msg": "value is not a valid email address", "type": "value_error.email" }
  ]
}
```

### 500 — Server Error
```json
{ "success": false, "message": "Internal server error", "data": null }
```

---

## 9. Authorization Rules

| Endpoint Group | Required Role | Authorization Rule |
|---------------|---------------|--------------------|
| `POST /auth/*`, `GET /auth/me` | None / Bearer | Public or token-based |
| `GET /users/me`, `PUT /users/me` | Bearer (any role) | Own profile only |
| `PUT /users/change-password` | Bearer (any role) | Own account only |
| `POST /brokers`, `GET /brokers`, etc. | Bearer + **ADMIN** | Admin role required |
| `POST /broker-sessions` | Bearer (any role) | Creates session for authenticated user |
| `GET /broker-sessions/{broker_id}` | Bearer (any role) | Returns own session only (filtered by `user_id`) |
| `DELETE /broker-sessions/{session_id}` | Bearer (any role) | **IDOR-protected:** verifies `session.user_id == current_user.id` |
| `GET /broker-data/*` | Bearer (any role) | Authenticated access |
| `POST|PUT|GET /broker-orders/*` | Bearer (any role) | Authenticated access |

> No cross-user data access is possible through any audited endpoint.

---

## 10. Security Restrictions (Frozen)

The following fields are **permanently excluded** from all API responses:

| Field | Schema | Reason |
|-------|--------|--------|
| `api_key` | BrokerResponse | Broker credential — must never be exposed |
| `api_secret` | BrokerResponse | Broker credential — must never be exposed |
| `access_token` | BrokerSessionResponse | Broker session token — must never be returned |
| `password_hash` | Any user response | Password hash — must never be exposed |
| `JWT_SECRET_KEY` | Any response | Application secret — never in responses |
| `DATABASE_URL` | Any response | Connection string — never in responses |

> **RULE:** If a future schema change introduces a credential field in a response,
> it must be treated as a Category D (Security) finding and fixed immediately.

---

## 11. Broker Session Contract

The broker session represents a temporary authenticated connection between the platform user
and the external broker API. It is created by the frontend after the user completes broker
OAuth/login and obtains a broker-specific `access_token`.

```
Frontend Broker Session Flow:
1. User authenticates with broker externally (e.g., Zerodha OAuth/TOTP)
2. Frontend receives broker access_token + expiry
3. POST /broker-sessions { broker_id, access_token, expires_at }
4. Backend stores encrypted access_token server-side
5. BrokerSessionResponse is returned (WITHOUT access_token — only metadata)
6. Frontend uses broker_id for all subsequent broker-data and broker-order calls
7. Backend resolves session internally using user_id + broker_id
```

**Security notes:**
- The broker `access_token` is accepted on creation but **never returned**
- Session revocation is user-ownership verified (IDOR protection in place)
- Session expiry is stored and must be respected by the backend service layer

---

## 12. Broker Data Contract

All broker data endpoints are **read-only** in the frontend integration layer.

| Endpoint | Data Returned | Notes |
|----------|---------------|-------|
| `/broker-data/{id}/profile` | Account info (id, type, currency) | No credentials |
| `/broker-data/{id}/holdings` | Equity holdings (symbol, qty, avg_price) | Decimal as string |
| `/broker-data/{id}/positions` | Intraday/overnight positions | Includes side |
| `/broker-data/{id}/orders` | Order list from broker | Historical |
| `/broker-data/{id}/quotes` | Real-time quotes | Requires `?symbols=` query |

> All decimal values are serialized as strings in Pydantic v2 with `Decimal` type.  
> Frontend must parse these as numbers before arithmetic operations.

---

## 13. Frontend Integration Notes

### Response Shape Handling
The frontend must handle **two** response shapes:

```javascript
// Type A — Wrapped (auth, brokers)
const data = response.data.data;  // access nested .data
const msg  = response.data.message;

// Type B — Direct (users, sessions, broker-data, broker-orders)
const data = response.data;       // direct object or array
```

### Token Storage
- Store tokens per the existing frontend convention (localStorage with key pattern in frontend services)
- Never log or transmit tokens in plain text outside of `Authorization` header

### Decimal Fields
These fields from broker data responses are Pydantic `Decimal` serialized as strings:
- `BrokerHolding.quantity`, `BrokerHolding.average_price`
- `BrokerPosition.quantity`, `BrokerPosition.avg_price`
- `BrokerOrder.quantity`
- `BrokerQuoteResponse.bid`, `BrokerQuoteResponse.ask`, `BrokerQuoteResponse.last_price`
- `BrokerOrderCreateRequest.quantity`, `BrokerOrderCreateRequest.price`, etc.

### UUID Fields
All `id`, `broker_id`, `user_id`, `session_id` fields are UUID strings (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).

---

## 14. Known Compatibility Exceptions

These are known, documented inconsistencies that are **not blocking** and must **not** be
changed without explicit approval:

| # | Issue | Module | Impact | Resolution |
|---|-------|--------|--------|-----------|
| 1 | `/users/me` returns **direct Pydantic** (no `success_response` wrapper) | Users | Low — frontend handles both | Documented; no change until breaking issue confirmed |
| 2 | `broker_sessions.py` imports `get_current_active_user` from route module instead of canonical dependency module | Internal | None — functionally identical | Documented; future cleanup only |

---

## 15. CORS Configuration

### Development (Current)
```
allow_origins=["*"]
allow_credentials=True
allow_methods=["*"]
allow_headers=["*"]
```

> **Note:** `allow_origins=["*"]` with `allow_credentials=True` is technically non-compliant with
> the CORS specification for credentialed requests. Browsers **may** block credentialed
> cross-origin requests. For local development with no CORS restrictions, this is functional.

### Production (Required before deployment)
```
allow_origins=["https://<your-production-domain>"]
allow_credentials=True
allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
allow_headers=["Authorization", "Content-Type", "Accept"]
```

> **Production action required:** Replace `"*"` with the explicit frontend origin before deploying.

---

## 16. Health Endpoint

| Method | Endpoint | Auth | Response |
|--------|----------|------|----------|
| GET | `/health` | None | `{ "status": "healthy" }` |

Used for liveness checks. Not part of the main API contract.

---

## Contract Change Log

| Version | Step | Change | Breaking |
|---------|------|--------|---------|
| 1.0 | 13.21I.34.81 | Initial audit complete. `BrokerResponse.api_key` removed (security fix). | No (addition was the defect) |
| 1.0 | 13.21I.34.82 | Contract frozen. This document created as authoritative reference. | — |
