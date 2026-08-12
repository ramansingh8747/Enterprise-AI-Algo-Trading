# STEP 13.21I.34.136 — System Notifications & Risk Alerts Server Persistence & REST API Integration

## Overview
This document details the implementation of authenticated PostgreSQL server-side System Notifications & Risk Alerts persistence and REST API integration. It replaces browser `localStorage` (`algo_trading_alerts`) with a multi-device persistent alert engine supporting auto-seeding for initial welcome notifications, real-time alert creation, unread count tracking, single & batch read operations, alert deletion, and strict user isolation.

---

## 1. Database Architecture & Models
Created SQLAlchemy ORM model in `backend/app/database/models/alert.py`:
- `Alert`:
  - `id`: UUID primary key.
  - `user_id`: UUID foreign key to `users.id` (`ON DELETE CASCADE`), indexed.
  - `type`: String(50), alert category (`SYSTEM`, `RISK`, `BROKER`, `ORDER`, `STRATEGY`).
  - `severity`: String(20), severity indicator (`INFO`, `SUCCESS`, `WARNING`, `DANGER`).
  - `title`: String(150), alert title.
  - `message`: Text, detailed alert payload.
  - `read`: Boolean, default `False`.
  - `route`: String(100), optional frontend navigation target.
  - `created_at`: DateTime(timezone=True), indexed.

---

## 2. Alembic Migration
Created Alembic migration `20260811230000_add_alerts_table.py` (Revises: `20260811220000`):
- `upgrade()`: Creates `alerts` table with foreign key constraint and indexes.
- `downgrade()`: Safely drops indexes and `alerts` table.
- Verified clean execution of both `alembic upgrade head` and `alembic downgrade -1`.

---

## 3. Repository & REST API Contract

### Repository (`AlertRepository`)
- `seed_initial_alerts(user_id)`: Seeds welcome notifications for new user accounts.
- `list_user_alerts(user_id, unread_only)`: Queries alerts owned by user ordered by `created_at.desc()`.
- `create_alert(...)`: Persists a new system/risk notification.
- `mark_as_read(alert_id, user_id)`: Marks an alert read with user ownership check.
- `mark_all_as_read(user_id)`: Marks all alerts read for user.
- `delete_alert(alert_id, user_id)`: Deletes an alert with user ownership check.
- `clear_all_alerts(user_id)`: Clears all alerts for user.

### REST API Endpoints (`/api/v1/alerts`)
- `GET /api/v1/alerts`: List user alerts (with optional `unread_only` query param).
- `POST /api/v1/alerts`: Create alert (returns HTTP 201 Created).
- `PATCH /api/v1/alerts/{alert_id}/read`: Mark alert read (HTTP 200).
- `POST /api/v1/alerts/mark-all-read`: Mark all alerts read (HTTP 200).
- `DELETE /api/v1/alerts/{alert_id}`: Delete single alert (HTTP 204).
- `DELETE /api/v1/alerts`: Clear all user alerts (HTTP 204).

---

## 4. Frontend Integration & LocalStorage Migration

### API Client (`alertsApi.ts`)
- Implemented `AlertsApi` inheriting `BaseApi` and exported through `frontend/src/services/api/index.ts`.

### Service Integration (`alertService.ts`)
- Extended `alertService.ts` to call `alertsApi.getAlerts()`, `createAlert()`, `markAsRead()`, `markAllAsRead()`, `deleteAlert()`, and `clearAllAlerts()`.
- Maintained synchronous fallback methods to ensure full backward compatibility for existing UI components.

---

## 5. Quality & Security Verification Summary

### Backend Unit Tests (`test_alerts_api.py`)
- Auto-seeding initial welcome alerts: **PASS**
- Creating custom risk/system alert: **PASS**
- Marking single alert as read: **PASS**
- Marking all alerts as read: **PASS**
- Deleting single alert (204): **PASS**
- Clearing all alerts (204): **PASS**
- User isolation & cross-user rejection (404): **PASS**
- Unauthenticated rejection (401): **PASS**
- Result: **8 passed / 0 failed (100% PASS)**

### Frontend Integration Tests (`alertsIntegration.test.tsx`)
- Server alert loading & storage cache update: **PASS**
- Synchronizing alert creation with server API: **PASS**
- Marking alert read on server API: **PASS**
- Clearing all alerts on server API: **PASS**
- Result: **4 passed / 0 failed (100% PASS)**

### Quality Gates
- Pytest Backend Suite: **382 passed / 0 failed (100% PASS)**
- Vitest Frontend Test Suite: **PASS**
- TypeScript (`npx tsc --noEmit`): **PASS (0 errors)**
- ESLint (`npm run lint`): **PASS (0 errors, 0 warnings)**
- Production Build (`npm run build`): **PASS**
