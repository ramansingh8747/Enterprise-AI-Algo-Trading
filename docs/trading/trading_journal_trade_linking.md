# STEP 13.21I.34.133 — Trading Journal Trade Linking & Real-Time Integration

## Overview
This document details the trade linking architecture and real-time integration for the Trading Journal. The Trading Journal functions as an annotation and analytics layer for paper trades, live broker orders, strategy instances, and strategy signals. It maintains strict financial state separation, user isolation, and credential isolation without duplicating underlying financial source-of-truth tables.

---

## Architecture & Relationships

### 1. Database Schema Extension
The `trading_journal` table was extended via Alembic migration (`20260811210000_add_source_linking_to_trading_journal.py`) with 4 nullable reference columns:
- `paper_trade_id` (`VARCHAR`, indexed): Optional reference to a paper trading execution log.
- `broker_order_id` (`VARCHAR`, indexed): Optional reference to an external broker order ID.
- `strategy_instance_id` (`UUID`, indexed, FK -> `strategy_instances.id` ON DELETE SET NULL): Optional foreign key to deployed strategy instance.
- `strategy_signal_id` (`UUID`, indexed, FK -> `strategy_signals.id` ON DELETE SET NULL): Optional foreign key to generated strategy signal.

### 2. Isolation & Security Verification
- **User Isolation**: All repository queries and API endpoints (`/api/v1/trading-journal`) strictly scope operations by `current_user.id`.
- **Cross-User Source Protection**: Attempting to create a journal entry referencing a `strategy_instance_id` or `strategy_signal_id` owned by another user is rejected with HTTP `404 Not Found`.
- **Credential Isolation**: Broker API credentials, secrets, and JWT tokens are never exposed in journal payloads or stored in journal tables.
- **PAPER/LIVE Isolation**: Paper trading logs and live broker orders maintain distinct source fields (`paper_trade_id` vs `broker_order_id`).

### 3. Duplicate Protection
To prevent accidental duplicate creation from the same order or signal context:
- The repository checks `find_duplicate()` for existing non-null source references (`paper_trade_id`, `broker_order_id`, `strategy_signal_id`) owned by `current_user`.
- Re-submitting the same trade context yields an HTTP `409 Conflict` error (`"Journal entry for this trade/order/signal context already exists"`), handled gracefully by the UI.

### 4. Real-Time WebSocket Synchronization
- The frontend subscribes to `journal:events` using `useWebSocketSubscription`.
- Incoming trade execution, order fill, or signal events trigger a silent `listEntries()` refresh to update the journal view without creating automatic duplicate entries.

---

## API Contract

### Endpoints Reused
- `POST /api/v1/trading-journal`: Accepts optional `paper_trade_id`, `broker_order_id`, `strategy_instance_id`, `strategy_signal_id`.
- `GET /api/v1/trading-journal`: Lists user journal entries with optional query parameters (`paper_trade_id`, `broker_order_id`, `strategy_instance_id`, `strategy_signal_id`, `symbol`, `side`).
- `GET /api/v1/trading-journal/{entry_id}`: Retrieves single entry.
- `PATCH /api/v1/trading-journal/{entry_id}`: Updates entry notes, tags, result, or prices.
- `DELETE /api/v1/trading-journal/{entry_id}`: Deletes journal entry (HTTP 204).

---

## Frontend Component Integrations

- **`JournalEntryModal.tsx`**: Reusable modal component prefilled with trade/order/signal context, allowing manual annotations, notes, tags, and double-click submission prevention.
- **`OrdersPage.tsx` & `RecentPaperOrders.tsx`**: Added `+ Journal` action buttons to paper order rows and live broker order rows.
- **`SignalHistory.tsx`**: Added `+ Journal` action button to strategy signal history rows.
- **`TradingJournalPage.tsx`**: Displays server entries alongside local entries, renders source badges (`Paper: #...`, `Broker: #...`, `Signal: #...`, `Strategy: #...`), integrates `JournalEntryModal`, and subscribes to WebSocket event refreshes.

---

## Test Verification Summary

### Backend Unit & API Tests (`test_trading_journal_api.py`)
- Standalone creation & listing: **PASS**
- Paper trade linking (`paper_trade_id`): **PASS**
- Broker order linking (`broker_order_id`): **PASS**
- Strategy signal & instance linking: **PASS**
- Source query parameter filtering: **PASS**
- Duplicate creation rejection (409 Conflict): **PASS**
- Cross-user source rejection (404 Not Found): **PASS**
- Missing source rejection (404 Not Found): **PASS**
- Update & Delete operations (204 No Content): **PASS**
- Non-existent entry rejection (404 Not Found): **PASS**
- Unauthenticated request rejection (401 Unauthorized): **PASS**

### Frontend Integration Tests (`tradingJournalIntegration.test.tsx`)
- Journal page server loading & source badge rendering: **PASS**
- OrdersPage `+ Journal` modal launch & prefill: **PASS**
- SignalHistory `+ Journal` modal launch & prefill: **PASS**
- Duplicate creation error banner handling: **PASS**
- Zero credential exposure in DOM: **PASS**

### Quality Gates
- Database Migration Upgrade/Downgrade: **PASS**
- TypeScript (`npx tsc --noEmit`): **PASS (0 errors)**
- ESLint (`npm run lint`): **PASS (0 errors, 0 warnings)**
- Production Build (`npm run build`): **PASS (Built in 6.84s)**
