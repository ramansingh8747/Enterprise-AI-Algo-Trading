# Frontend Strategy Lifecycle Integration

## Overview
This document outlines the frontend implementation for Strategy Instance lifecycle management (Start/Pause/Resume/Stop) and Signal History display.

## Functionality
- **Strategy Instance Management**: List instances, display status, perform lifecycle actions (Start, Pause, Resume, Stop).
- **FSM Adherence**: Actions strictly follow the backend FSM:
  - `DRAFT` -> `READY` -> `RUNNING` (Start)
  - `RUNNING` -> `PAUSED` (Pause)
  - `PAUSED` -> `RUNNING` (Resume)
  - `RUNNING | PAUSED | READY` -> `STOPPED` (Stop)
- **Signal History**: View signal history for specific instances.
- **Loading & Error Handling**: UI handles action loading states, empty states, and API errors.

## PAPER/LIVE Safety
- PAPER mode is the default and displayed in the UI.
- All lifecycle actions are performed through the Strategy lifecycle API only.

## Security
- Credentials are not stored, logged, or exposed in the UI.
- All requests are authorized.

## Remaining Gaps
- Real-time updates (WebSocket) for lifecycle state and signal history.
- Advanced strategy configuration UI.
