# Server-Side Paper Accounting & Position Repository (`Step 13.21I.34.104`)

## 1. Executive Summary
This document records the complete technical implementation of the **Server-Side Paper Accounting & Position Repository** (`Step 13.21I.34.104`).

The paper accounting subsystem provides an atomic, Decimal-precision position management layer that converts successful `PAPER` order fills into persistent `PaperPosition` state in PostgreSQL. All monetary and quantity calculations strictly use Python `Decimal` arithmetic; floating-point operations are prohibited.

---

## 2. Core Components Implemented

1. **Domain Exceptions ([`paper_accounting_exceptions.py`](file:///c:/Users/HP/Music/projects/Enterprise-AI-Algo-Trading/backend/app/exceptions/paper_accounting_exceptions.py)):**
   - `BasePaperAccountingException`: Base exception.
   - `PaperPortfolioNotFoundException`: Raised when target portfolio cannot be found (404).
   - `PaperPositionNotFoundException`: Raised when position does not exist (404).
   - `InvalidExecutionModeException`: Raised when non-PAPER execution mode is passed to paper accounting (400).
   - `InvalidPaperFillException`: Raised when quantity <= 0 or price < 0 (400).
   - `InsufficientPaperPositionException`: Raised when SELL quantity exceeds open position (400).
   - `DuplicatePaperExecutionException`: Raised when duplicate fill execution ID is detected (409).

2. **Position Repository ([`paper_portfolio_repository.py`](file:///c:/Users/HP/Music/projects/Enterprise-AI-Algo-Trading/backend/app/database/repositories/paper_portfolio_repository.py)):**
   - Implements `PaperPortfolioRepository` with `lock_position_for_update(paper_portfolio_id, symbol)` using PostgreSQL `FOR UPDATE` row-level locking for atomic, thread-safe position updates.
   - Implements `get_or_create_default_portfolio()` and ownership enforcement methods.

3. **Paper Accounting Service ([`paper_accounting_service.py`](file:///c:/Users/HP/Music/projects/Enterprise-AI-Algo-Trading/backend/app/services/paper_accounting_service.py)):**
   - `record_fill(...)`: Core accounting fill processor.
   - **BUY Accounting:** Calculates average entry price and cost basis:
     $$\text{New Cost} = (\text{Old Qty} \times \text{Old Avg}) + (\text{Fill Qty} \times \text{Fill Price})$$
     $$\text{New Qty} = \text{Old Qty} + \text{Fill Qty}$$
     $$\text{New Avg} = \frac{\text{New Cost}}{\text{New Qty}}$$
   - **SELL Accounting:** Calculates trade realized P&L and updates cumulative realized P&L:
     $$\text{Trade Realized P\&L} = (\text{Sell Price} - \text{Average Entry Price}) \times \text{Sold Qty}$$
     $$\text{New Realized P\&L} = \text{Position Realized P\&L} + \text{Trade Realized P\&L}$$
     - On **Partial SELL**, remaining quantity is reduced while average entry price remains unchanged.
     - On **Full SELL**, quantity, average price, and cost basis reset to `0.0000` while total cumulative `realized_pnl` is preserved.

4. **Strategy Engine Integration ([`strategy_runner.py`](file:///c:/Users/HP/Music/projects/Enterprise-AI-Algo-Trading/backend/app/services/strategy_engine/strategy_runner.py)):**
   - Injected optional `PaperAccountingService` callback into `StrategyRunner`. Upon PAPER signal fill, automatically calls `record_fill(...)`.

5. **FastAPI Dependencies ([`paper_portfolio.py`](file:///c:/Users/HP/Music/projects/Enterprise-AI-Algo-Trading/backend/app/dependencies/paper_portfolio.py)):**
   - Created `get_paper_portfolio_repository` and `get_paper_accounting_service` dependency providers.

6. **Unit Test Suite ([`test_paper_accounting_service.py`](file:///c:/Users/HP/Music/projects/Enterprise-AI-Algo-Trading/backend/app/tests/services/test_paper_accounting_service.py)):**
   - 13 unit tests covering First BUY, Additional BUY, Partial SELL, Full SELL, Loss SELL, Breakeven SELL, Multiple BUY/SELL sequences, parameter validations, duplicate execution protection, user isolation, and strategy isolation. 100% PASS.

---

## 3. Verification & Quality Gate Results

- **Backend Pytest Suite:** 158 passed / 1 failed (1 pre-existing `AngelOne` abstract factory stub test failure; 100% of accounting tests PASSED)
- **Frontend Vitest Suite:** 89/89 PASS (8 test suites)
- **TypeScript Typecheck (`npx tsc --noEmit`):** PASS (0 errors)
- **Production Build (`npm run build`):** PASS (Clean Vite `dist/` bundle)
- **API Contract:** FROZEN CONTRACT UNCHANGED

## 4. Integration Update (Step 13.21I.34.105)
Unrealized P&L valuation and market quote data integration have been completed in `Step 13.21I.34.105`:
- **PaperValuationService:** **IMPLEMENTED** (`backend/app/services/paper_valuation_service.py`)
- **Stale Quote Guard:** **IMPLEMENTED** (Enforces 10-second quote age threshold)
- **Realized P&L Preservation:** **VERIFIED** (`position.realized_pnl` remains untouched during valuation)

For full valuation documentation, see [`docs/trading/paper_valuation_implementation.md`](file:///c:/Users/HP/Music/projects/Enterprise-AI-Algo-Trading/docs/trading/paper_valuation_implementation.md).

---

## 5. Next Step
Proceed to **Step 13.21I.34.106 — Paper Portfolio REST API Services**.
