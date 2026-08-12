# Paper Portfolio Cash & Buying Power Enforcement (`Step 13.21I.34.124 — GAP-008`)

## 1. Objective

Implement GAP-008: Paper Portfolio Cash & Buying Power Enforcement to ensure that PAPER trading cannot execute BUY orders when the paper portfolio does not have sufficient available cash / buying power.

---

## 2. Architecture & Data Flow

```
                  [PAPER BUY Order Request]
                              │
                              ▼
                 [Required Order Cost Calculation]
                 (order_cost = quantity × price)
                              │
                              ▼
            [PaperPortfolio.cash_balance Check]
                              │
             ┌────────────────┴────────────────┐
             │                                 │
  (cash_balance < order_cost)      (cash_balance >= order_cost)
             │                                 │
             ▼                                 ▼
[InsufficientPaperCashException]   [Deduct Cash Balance]
             │                     (cash = cash - order_cost)
             ▼                                 │
   [Signal Status = REJECTED]                  ▼
             │                   [Update Position Accounting]
             ▼                                 │
 [Publish signal.rejected Event]               ▼
                                   [Signal Status = EXECUTED]
                                               │
                                               ▼
                                  [Publish signal.executed Event]
```

---

## 3. Core Technical Features

### 3.1 Cash & Buying Power Enforcement (`backend/app/services/paper_accounting_service.py`)
- **Buying Power Validation:** Before recording a PAPER BUY fill, compares `portfolio.cash_balance` against required order funds (`order_cost = quantity * price`).
- **Controlled Exception:** Raises `InsufficientPaperCashException` if `portfolio.cash_balance < order_cost`.
- **Atomic Balance Updates:**
  - `BUY`: Deducts required funds from `cash_balance` (`portfolio.cash_balance = portfolio.cash_balance - order_cost`).
  - `SELL`: Validates `quantity <= position.quantity`, calculates sale proceeds (`proceeds = quantity * price`), adds proceeds to `cash_balance` (`portfolio.cash_balance = portfolio.cash_balance + proceeds`), and updates realized P&L.
- **Row-Level Database Locking:** Locks portfolio row using `lock_portfolio_for_update(portfolio.id)` to prevent concurrent cash balance race conditions.

### 3.2 Strategy Runner Rejection Handling (`backend/app/services/strategy_engine/strategy_runner.py`)
- **Controlled Signal Rejection:** If `PaperAccountingService.record_fill()` raises `InsufficientPaperCashException` during paper execution:
  - Sets `signal_record.status = "REJECTED"`.
  - Publishes `EventType.SIGNAL_REJECTED` event over `EventBus`.
  - Returns `None` safely without interrupting the `StrategySchedulerService` or worker loops.

### 3.3 Database Repository Extension (`backend/app/database/repositories/paper_portfolio_repository.py`)
- Added `lock_portfolio_for_update(portfolio_id: UUID)` method using SQL `FOR UPDATE` row-level locking.

---

## 4. Verification & Test Results

### 4.1 Backend Test Suite (`backend/app/tests/services/test_paper_cash_buying_power.py`)
- **Result:** 20 passed / 0 failed
- **Paper Accounting Test Suite (`test_paper_accounting_service.py`):** 13 passed / 0 failed
- **Full Backend Pytest Suite:** 348 passed / 3 failed (3 pre-existing environment Fernet key failures)
- Tests covered: Sufficient cash BUY succeeds, insufficient cash BUY rejected, exact cash BUY succeeds, cash balance unchanged after rejection, cash balance decreases on BUY, Decimal precision preservation (`0.0001` quantize), `quantity * price` order cost calculation, existing fee inclusion, SELL flow compatibility, insufficient holdings SELL rejection, buying power calculation, reserved funds handling, multi-order cash impact, rejected order position prevention, rejected order event safety, StrategyRunner stability, StrategyScheduler stability, PAPER/LIVE isolation, duplicate fill protection, and non-negative cash balance enforcement.

---

## 5. Security & Boundary Rules

- **PAPER / LIVE Isolation:** Cash & buying power validation applies strictly to `PAPER` execution mode. `LIVE` execution mode continues to delegate risk enforcement and buying power validation to `BrokerOrderService` & `RiskEngine`.
- **Zero Credential Exposure:** Logs and events confirm zero exposure of API keys, tokens, or credentials.
- **REST & DB Integrity:** REST API contracts and database schemas remain unchanged.
