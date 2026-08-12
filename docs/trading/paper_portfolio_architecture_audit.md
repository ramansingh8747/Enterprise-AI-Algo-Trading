# Paper Portfolio Position & P&L Architecture Audit (`Step 13.21I.34.102`)

## 1. Executive Summary
This document provides a comprehensive architectural audit and implementation design for adding a dedicated, server-side **Paper Portfolio Position & P&L Subsystem** to the Enterprise AI Algo Trading Platform.

Currently, the Strategy Engine generates paper trade execution objects (`status: "COMPLETE"`, `order_id: "PAPER-..."`) in `StrategyRunner.execute_cycle()`. However, server-side persistence for paper account balances, average cost basis, realized P&L, and unrealized P&L is currently **MISSING**. On the frontend, paper trading is rendered using client-side `localStorage` prototypes.

This audit establishes a safe, Decimal-precision financial accounting design that integrates paper strategy order fills directly into a database-persisted `PaperPortfolio` and `PaperPosition` model while guaranteeing complete isolation from live broker execution.

---

## 2. Discovery & Classification Matrix

| Subsystem / Feature | Current Codebase Implementation | Classification |
| :--- | :--- | :--- |
| **Strategy Engine Runner** | Server-side execution loop (`StrategyRunner`) generating paper order candidates | **IMPLEMENTED** |
| **Paper Execution Mode** | Mode routing (`execution_mode: "PAPER"` vs `"LIVE"`) preventing live broker SDK calls | **IMPLEMENTED** |
| **Paper Order Model** | `StrategySignal` ORM table storing proposed/executed strategy signals | **PARTIAL** |
| **Frontend Paper Sandbox** | Client-side UI state stored in `localStorage` (`algo_trading_paper_orders_v1`) | **PROTOTYPE** |
| **Server-Side Paper Portfolio** | Database table for tracking virtual paper cash balances and equity | **MISSING** |
| **Server-Side Paper Positions** | Database table for tracking net paper symbol holdings and average entry price | **MISSING** |
| **Realized P&L Accounting** | Server-side cumulative & transaction-level realized P&L tracking | **MISSING** |
| **Unrealized P&L Accounting** | Quote-driven dynamic unrealized P&L calculations with Stale Quote Protection | **MISSING** |

---

## 3. Position Accounting & Financial Calculation Rules

### 3.1 Financial Precision Standard
All financial values (quantities, prices, balances, P&L) MUST use Python's `Decimal` type on the backend and SQL `NUMERIC(18, 4)` in PostgreSQL. Binary floating-point arithmetic (`float`) is strictly prohibited.

### 3.2 Position & Cost Basis Formulas

#### 1. Long Position Expansion (BUY Order)
$$\text{new\_quantity} = \text{current\_quantity} + \text{buy\_quantity}$$

$$\text{new\_average\_price} = \frac{(\text{current\_quantity} \times \text{current\_average\_price}) + (\text{buy\_quantity} \times \text{buy\_price})}{\text{new\_quantity}}$$

$$\text{cash\_balance} \leftarrow \text{cash\_balance} - (\text{buy\_quantity} \times \text{buy\_price})$$

#### 2. Long Position Reduction / Closure (SELL Order)
$$\text{trade\_qty} = \min(\text{sell\_quantity}, \text{current\_quantity})$$

$$\text{realized\_pnl\_delta} = (\text{sell\_price} - \text{current\_average\_price}) \times \text{trade\_qty}$$

$$\text{new\_quantity} = \text{current\_quantity} - \text{trade\_qty}$$

$$\text{cash\_balance} \leftarrow \text{cash\_balance} + (\text{sell\_quantity} \times \text{sell\_price})$$

$$\text{portfolio.realized\_pnl} \leftarrow \text{portfolio.realized\_pnl} + \text{realized\_pnl\_delta}$$

*Note:* If $\text{new\_quantity} = 0$, position is flat and `average_price` resets to 0.

#### 3. Unrealized P&L Calculation
$$\text{unrealized\_pnl} = (\text{current\_market\_price} - \text{average\_price}) \times \text{current\_quantity}$$

*Stale Quote Guard:* If `current_market_price` timestamp is missing or older than 10 seconds, `unrealized_pnl` is marked stale and Fail-Closed rules apply.

---

## 4. Recommended Database Domain Models

```python
class PaperPortfolio(Base):
    """ORM model for paper trading accounts."""
    __tablename__ = "paper_portfolios"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    strategy_instance_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("strategy_instances.id", ondelete="SET NULL"), nullable=True, index=True)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="INR")
    initial_balance: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("1000000.0000"))
    cash_balance: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("1000000.0000"))
    realized_pnl: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0.0000"))


class PaperPosition(Base):
    """ORM model for net paper positions per portfolio and symbol."""
    __tablename__ = "paper_positions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    paper_portfolio_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("paper_portfolios.id", ondelete="CASCADE"), nullable=False, index=True)
    symbol: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0.0000"))
    average_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0.0000"))
    realized_pnl: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0.0000"))

    __table_args__ = (
        UniqueConstraint("paper_portfolio_id", "symbol", name="uq_paper_portfolio_symbol"),
    )
```

---

## 5. Automation Readiness Matrix

| Capability | Status | Evidence | Risk |
| :--- | :--- | :--- | :--- |
| **Paper Order Fills** | **PASS** | `StrategyRunner` PAPER mode | **LOW** |
| **Paper Portfolio Storage** | **MISSING** | Needs Alembic migration | **MEDIUM** |
| **Position Average Price Accounting** | **READY** | Formula verified (Section 3) | **LOW** |
| **Realized P&L Calculation** | **READY** | Formula verified (Section 3) | **LOW** |
| **Unrealized P&L Calculation** | **READY** | Broker REST quote integration | **LOW** |
| **Multi-Strategy Isolation** | **READY** | `strategy_instance_id` FK scope | **LOW** |
| **Multi-User Isolation** | **READY** | `user_id` FK scope | **LOW** |
| **Transaction Safety** | **READY** | PostgreSQL `SELECT FOR UPDATE` | **LOW** |
| **Paper/Live Execution Isolation** | **PASS** | `execution_mode` hard boundary | **LOW** |

---

## 6. Recommended Implementation Sequence

1. **Step 13.21I.34.103 — Backend Paper Portfolio ORM Models & Alembic Migration:**
   - Create `paper_portfolios`, `paper_positions`, and `paper_transactions` tables.
2. **Step 13.21I.34.104 — Server-Side Paper Accounting & Position Repository:**
   - Implement `PaperAccountingService` handling Decimal position updates and atomic transactions.
3. **Step 13.21I.34.105 — Strategy Engine & Quote Data Integration:**
   - Connect `StrategyRunner` paper order fills to `PaperAccountingService` and compute unrealized P&L via quote service.
4. **Step 13.21I.34.106 — Paper Portfolio REST API Services:**
   - Implement `GET /paper-portfolios` and `GET /paper-positions` endpoints.
5. **Step 13.21I.34.107 — Frontend Paper Portfolio Integration:**
   - Update `OrdersPage` and `PortfolioPage` UI components to consume backend Paper Portfolio APIs.
6. **Step 13.21I.34.108 — Paper Portfolio E2E Safety Gate:**
   - Validate full paper order -> paper position -> P&L lifecycle.

---

## 7. Step 13.21I.34.103 Implementation Update

The database foundation for the Paper Portfolio subsystem has been implemented in `Step 13.21I.34.103`:
- **PaperPortfolio Model:** **IMPLEMENTED** (`backend/app/database/models/paper_portfolio.py`)
- **PaperPosition Model:** **IMPLEMENTED** (`backend/app/database/models/paper_portfolio.py`)
- **Decimal Precision Standard:** **IMPLEMENTED** (`Numeric(18, 4)` / Python `Decimal`)
- **Alembic Migration:** **IMPLEMENTED** (`backend/alembic/versions/20260811000000_create_paper_portfolio_tables.py`)

For full technical documentation, see [`docs/trading/paper_portfolio_models_implementation.md`](file:///c:/Users/HP/Music/projects/Enterprise-AI-Algo-Trading/docs/trading/paper_portfolio_models_implementation.md).

## 8. Step 13.21I.34.104 Implementation Update

The server-side paper accounting foundation has been implemented in `Step 13.21I.34.104`:
- **PaperAccountingService:** **IMPLEMENTED** (`backend/app/services/paper_accounting_service.py`)
- **PaperPortfolioRepository:** **IMPLEMENTED** (`backend/app/database/repositories/paper_portfolio_repository.py`)
- **Average Price & Cost Basis Accounting:** **IMPLEMENTED** (Decimal precision FIFO/Average cost calculation)
- **Realized P&L Accounting:** **IMPLEMENTED** (Calculates trade realized P&L on partial/full SELL)
- **Position Row Locking:** **IMPLEMENTED** (PostgreSQL `FOR UPDATE` transaction safety)
- **StrategyRunner Integration:** **IMPLEMENTED** (`StrategyRunner` automatically dispatches paper order fills to `PaperAccountingService`)
## 9. Step 13.21I.34.105 Implementation Update

The PAPER portfolio market-price valuation layer has been implemented in `Step 13.21I.34.105`:
- **PaperValuationService:** **IMPLEMENTED** (`backend/app/services/paper_valuation_service.py`)
- **Unrealized P&L Accounting:** **IMPLEMENTED** (Calculates $(\text{Current Price} - \text{Average Price}) \times \text{Quantity}$)
- **Stale Quote Guard:** **IMPLEMENTED** (Enforces 10-second quote age threshold, fail-closed on stale or future timestamps)
- **Realized P&L Preservation:** **VERIFIED** (`position.realized_pnl` remains untouched during market price refresh)
- **Missing Quote Safety:** **VERIFIED** (Positions without valid quotes are skipped without resetting unrealized P&L or setting price to 0)

For full technical documentation, see [`docs/trading/paper_valuation_implementation.md`](file:///c:/Users/HP/Music/projects/Enterprise-AI-Algo-Trading/docs/trading/paper_valuation_implementation.md).

## 10. Step 13.21I.34.106 Implementation Update

The backend REST API layer for the Paper Portfolio subsystem has been implemented in `Step 13.21I.34.106`:
- **Paper Portfolio Endpoints:** **IMPLEMENTED** (`GET /paper-portfolios`, `POST /paper-portfolios`, `GET /paper-portfolios/{id}`)
- **Paper Positions Endpoint:** **IMPLEMENTED** (`GET /paper-portfolios/{id}/positions`)
- **Portfolio Summary Endpoint:** **IMPLEMENTED** (`GET /paper-portfolios/{id}/summary`)
- **Server-Side Ownership Enforcement:** **VERIFIED** (Derives identity from JWT, returns 404 for unowned portfolios)
- **Zero Credential Exposure:** **AUDITED** (No credentials or API secrets exposed in any payload)
- **Decimal Financial Serialization:** **VERIFIED** (All monetary & quantity fields serialize with Decimal precision)
- **New API Contract Document:** **CREATED** ([`paper_portfolio_api_contract.md`](file:///c:/Users/HP/Music/projects/Enterprise-AI-Algo-Trading/docs/api/paper_portfolio_api_contract.md))

For full technical documentation, see [`docs/trading/paper_portfolio_api_implementation.md`](file:///c:/Users/HP/Music/projects/Enterprise-AI-Algo-Trading/docs/trading/paper_portfolio_api_implementation.md).

---

## 11. Step 13.21I.34.107 Implementation Update

The frontend integration for the Paper Portfolio subsystem has been implemented in `Step 13.21I.34.107`:
- **Paper Portfolio Types:** **IMPLEMENTED** ([`paperPortfolio.ts`](file:///c:/Users/HP/Music/projects/Enterprise-AI-Algo-Trading/frontend/src/types/paperPortfolio.ts))
- **Paper Portfolio API Client:** **IMPLEMENTED** ([`paperPortfolioApi.ts`](file:///c:/Users/HP/Music/projects/Enterprise-AI-Algo-Trading/frontend/src/services/api/paperPortfolioApi.ts))
- **Portfolio UI Integration:** **IMPLEMENTED** ([`PortfolioPage.tsx`](file:///c:/Users/HP/Music/projects/Enterprise-AI-Algo-Trading/frontend/src/pages/portfolio/PortfolioPage.tsx))
- **Decimal Financial Precision:** **VERIFIED** (Decimal string formatting without float conversion)
- **Frontend Test Suite:** **PASS** (98/98 tests passing across 10 test suites)

For full technical documentation, see [`docs/trading/frontend_paper_portfolio_integration.md`](file:///c:/Users/HP/Music/projects/Enterprise-AI-Algo-Trading/docs/trading/frontend_paper_portfolio_integration.md).

---

## 12. Step 13.21I.34.108 Final Safety Gate Update

The end-to-end safety and regression audit has been completed in `Step 13.21I.34.108`:
- **Subsystem E2E Safety Gate:** **`PAPER PORTFOLIO E2E SAFETY GATE PASSED`**
- **Release Decision:** **`GO`**
- **Code Changes:** **`0 CODE CHANGES` (AUDIT ONLY)**
- **Backend Quality Gate:** **PASS** (177 passed / 1 pre-existing AngelOne failure)
- **Frontend Quality Gate:** **PASS** (98 passed / 0 failed)
- **TypeScript Typecheck:** **PASS** (0 errors)
- **ESLint Check:** **PASS** (0 errors)
- **Production Build:** **PASS** (Clean build compiled in 6.26s)

For full E2E safety report, see [`docs/trading/paper_portfolio_e2e_safety_gate.md`](file:///c:/Users/HP/Music/projects/Enterprise-AI-Algo-Trading/docs/trading/paper_portfolio_e2e_safety_gate.md).

