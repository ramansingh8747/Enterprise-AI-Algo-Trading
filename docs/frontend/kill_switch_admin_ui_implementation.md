# Emergency Kill Switch Admin UI (`Step 13.21I.34.125 — GAP-007`)

## 1. Objective

Implement GAP-007: Emergency Kill Switch Admin UI. Provides an administrator-facing UI to view Emergency Kill Switch status, activate the Emergency Kill Switch with modal confirmation, and deactivate the Emergency Kill Switch where authorized.

---

## 2. Architecture & Control Flow

```
                      [Admin UI: KillSwitchPage]
                                  │
                                  ▼
                        [KillSwitchStatus Component]
                                  │
                      ┌───────────┴───────────┐
                      │                       │
               [ACTIVATE Button]       [DEACTIVATE Button]
                      │                       │
                      ▼                       ▼
            [Confirmation Modal]    [Confirmation Modal]
                      │                       │
                      ▼                       ▼
           [riskApi.activateKillSwitch] [riskApi.deactivateKillSwitch]
                      │                       │
                      └───────────┬───────────┘
                                  │
                                  ▼
                   [FastAPI REST API Routes]
                   (/api/v1/admin/risk/kill-switch/*)
                                  │
                                  ▼
                      [TradingRiskRepository]
                                  │
                                  ▼
                       [RiskEngine Halted State]
```

---

## 3. Core Technical Features

### 3.1 Backend REST API (`backend/app/api/v1/routes/risk.py`)
- `GET /api/v1/admin/risk/kill-switch`: Returns current Kill Switch status (`ACTIVE` vs `INACTIVE`), timestamp, and user ID. Requires authenticated user.
- `POST /api/v1/admin/risk/kill-switch/activate`: Calls `TradingRiskRepository.set_kill_switch(active=True)`. Returns updated status and halt message. Requires authenticated user.
- `POST /api/v1/admin/risk/kill-switch/deactivate`: Calls `TradingRiskRepository.set_kill_switch(active=False)`. Returns updated status and restoration message. Requires authenticated user.

### 3.2 Frontend API Client (`frontend/src/services/api/riskApi.ts`)
- `riskApi.getKillSwitchStatus()`
- `riskApi.activateKillSwitch()`
- `riskApi.deactivateKillSwitch()`

### 3.3 Admin UI & Safety Confirmation (`frontend/src/components/admin/KillSwitchStatus.tsx`)
- Visual Status Banner: Red `ACTIVE` banner when trading is halted, Green `INACTIVE` banner under normal conditions.
- Confirmation Modal: High-impact actions require explicit modal confirmation before executing API calls.
- Action Buttons: `ACTIVATE` and `DEACTIVATE` buttons automatically disable when already in target state or during pending API requests to prevent duplicate submissions.
- Feedback Alerts: Renders success and error banners with safe backend response messages.

---

## 4. Verification & Quality Gates

- **Frontend Vitest Suite (`src/tests/killSwitchAdmin.test.tsx`):** 15 passed / 0 failed
- **Backend Pytest Suite (`app/tests/api/v1/test_risk_api.py`):** 3 passed / 0 failed
- **TypeScript (`npx tsc --noEmit`):** PASS (0 errors)
- **ESLint (`npm run lint`):** Changed files 0 errors / 0 warnings
- **Production Build (`npm run build`):** PASS (`dist/assets/KillSwitchPage-LXNLdwt9.js` generated)

---

## 5. Security & Boundary Rules

- Reuses existing FastAPI authentication & dependency injection.
- Zero credential exposure: API keys, tokens, and secrets are never rendered in the DOM.
- Backend state remains authoritative source of truth.
