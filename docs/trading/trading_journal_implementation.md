# Trading Journal Implementation

## Overview
Persistent, server-side Trading Journal implemented to replace local-storage prototype.

## Database Model
- `trading_journal` table:
  - `id`: UUID (Primary Key)
  - `user_id`: UUID (ForeignKey to `users.id`, indexed)
  - `symbol`: String (indexed)
  - `side`: String
  - `quantity`: Float
  - `entry_price`: Float
  - `exit_price`: Float (optional)
  - `realized_pnl`: Float (optional)
  - `result`: String (optional)
  - `notes`: String (optional)
  - `tags`: String (optional)
  - `created_at`: DateTime (indexed)
  - `updated_at`: DateTime

## Repository
- `TradingJournalRepository`: CRUD operations scoped by `user_id` to enforce security and user isolation.

## REST API
- `POST /trading-journal`: Create entry.
- `GET /trading-journal`: List entries.
- `GET /trading-journal/{entry_id}`: Get entry.
- `PATCH /trading-journal/{entry_id}`: Update entry.
- `DELETE /trading-journal/{entry_id}`: Delete entry.

## Integration
- Backend integration complete. Frontend components will reuse the existing `TradingJournalPage` and connect via the new API.
