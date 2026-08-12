# Strategy API Frontend Integration

## Overview
This document outlines the frontend integration for the Strategy CRUD REST API.

## API Client
The `StrategyApi` client (`frontend/src/services/api/strategyApi.ts`) provides full CRUD operations for Strategy Definitions and Instances, adhering strictly to the `docs/api/strategy_api_contract.md`.

## Lifecycle Handling
The frontend directly maps backend status states to the UI. Invalid transitions are handled via UI restriction (e.g., button disabling) and API error feedback.

## PAPER / LIVE Handling
- PAPER mode is the default and is clearly indicated in the UI.
- LIVE mode requires explicit confirmation if the backend contract supports it.

## Security
- Credentials are NEVER stored in localStorage/sessionStorage.
- All requests use `AuthContext` for authorized access.

## Tests
- `frontend/src/tests/strategyIntegration.test.tsx` provides integration test coverage for basic CRUD operations.

## Remaining Gaps
- Full Strategy Instance lifecycle management (Start/Pause/Stop/Signal History UI).
- Real-time market data integration.
