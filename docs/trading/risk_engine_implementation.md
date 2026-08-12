# Backend Trading Risk Engine & Order Guardrails Service (`Step 13.21I.34.98`)

## 1. Executive Summary
This document records the complete technical implementation of the **Server-Side Backend Trading Risk Engine and Order Guardrails Service**.

The Risk Engine sits between idempotency validation and broker execution in `BrokerOrderService.place_order()`. It enforces application-level pre-trade risk controls, maximum order size caps, maximum notional bounds, position limits, order frequency rate limits, daily loss limits, and emergency kill switches before any request reaches external broker SDKs.

---

## 2. Risk Engine Architecture & Pipeline

```
[POST /broker-orders/{broker_id}]
   │
   ▼
[AUTHENTICATION & ROLE AUTHORIZATION]
   │
   ▼
[IDEMPOTENCY CHECK (`X-Idempotency-Key`)]
   │
   ▼
[RISK ENGINE (`RiskEngine.validate_order`)]
   │
   ├─► 1. Emergency Kill Switch (`TradingRiskSettings.kill_switch_active`)
   ├─► 2. Order Frequency Rate Limiter (`max_orders_per_minute` in window)
   ├─► 3. Max Order Quantity Guard (`quantity <= max_order_quantity`)
   ├─► 4. Max Order Notional Guard (`quantity * price <= max_order_notional`)
   ├─► 5. Position Limit Guard (`current_pos + order_qty <= max_position_quantity`)
   └─► 6. Daily Loss & Drawdown Guard (`daily_loss <= daily_loss_limit`)
   │
   ▼
[BROKER ORDER SERVICE]
   │
   ▼
[EXTERNAL BROKER SDK (`ZerodhaBroker` / KiteConnect)]
```

---

## 3. Core Components Implemented

1. **Risk Exceptions ([`risk_exceptions.py`](file:///c:/Users/HP/Music/projects/Enterprise-AI-Algo-Trading/backend/app/exceptions/risk_exceptions.py)):**
   - `RiskLimitExceededException`: HTTP 400 Bad Request (Order size, notional, position, or frequency limit violation).
   - `TradingHaltedException`: HTTP 400 Bad Request (Emergency kill switch active or daily loss threshold breached).

2. **ORM Database Model ([`trading_risk_settings.py`](file:///c:/Users/HP/Music/projects/Enterprise-AI-Algo-Trading/backend/app/database/models/trading_risk_settings.py)):**
   - Table: `trading_risk_settings`
   - Scoped fields: `user_id` (nullable), `broker_id` (nullable), `max_order_quantity`, `max_order_notional`, `max_position_quantity`, `max_exposure_notional`, `max_orders_per_minute`, `daily_loss_limit`, `max_drawdown_percent`, `kill_switch_active`.

3. **Repository Layer ([`trading_risk_repository.py`](file:///c:/Users/HP/Music/projects/Enterprise-AI-Algo-Trading/backend/app/database/repositories/trading_risk_repository.py)):**
   - `get_risk_settings()`: Scoped resolution (User+Broker -> User -> Global Default).
   - `count_recent_orders_in_window()`: Atomic rate limiting over `order_idempotency_records`.
   - `set_kill_switch()`: Administrative kill switch toggle.

4. **Service Layer ([`risk_engine.py`](file:///c:/Users/HP/Music/projects/Enterprise-AI-Algo-Trading/backend/app/services/risk_engine.py)):**
   - Implements `validate_order()` enforcing strict guardrail checks prior to order placement.

5. **Orchestration Integration ([`broker_order_service.py`](file:///c:/Users/HP/Music/projects/Enterprise-AI-Algo-Trading/backend/app/services/broker_order_service.py)):**
   - Injected into `BrokerOrderService`. Calls `self._risk_engine.validate_order()` inside `execute_fn()` and non-idempotent order paths.

6. **Database Migration ([`20260810233000_create_trading_risk_settings_table.py`](file:///c:/Users/HP/Music/projects/Enterprise-AI-Algo-Trading/backend/alembic/versions/20260810233000_create_trading_risk_settings_table.py)):**
   - Alembic migration for `trading_risk_settings` table.

---

## 4. Verification & Quality Gate Results

- **Backend Pytest Suite:** 133 passed / 1 failed (1 pre-existing `AngelOne` abstract factory stub test failure; 100% of all 8 `RiskEngine` unit and integration tests PASSED)
- **Frontend Vitest Suite:** 89/89 PASS (8 test suites)
- **TypeScript Typecheck (`npx tsc --noEmit`):** PASS (0 errors)
- **Production Build (`npm run build`):** PASS (Clean Vite `dist/` bundle)
- **API Contract:** FROZEN CONTRACT UNCHANGED

---

## 5. Automation Readiness Assessment

- **Manual Controlled Live Trading:** **READY**
- **Assisted Trading:** **READY**
- **Paper Automated Strategies:** **READY**
- **Controlled Live Automated Strategies:** **RISK ENGINE READY — CONTROLLED LIVE AUTOMATION** (Server-side pre-trade risk guardrails, order size caps, rate limiting, and emergency kill switches implemented).

---

## 6. Strategy Engine Integration Status

Notice: Automatic strategy engine execution and background signal generation loops have **NOT** yet been implemented (`Step 13.21I.34.99`). The `RiskEngine` remains the mandatory server-side safety boundary through which all future strategy signals must pass before reaching broker execution.

For strategy architecture audit details, see [`docs/trading/strategy_engine_architecture_audit.md`](file:///c:/Users/HP/Music/projects/Enterprise-AI-Algo-Trading/docs/trading/strategy_engine_architecture_audit.md).
