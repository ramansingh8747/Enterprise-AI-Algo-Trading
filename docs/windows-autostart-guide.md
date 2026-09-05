# Windows Auto-Start Guide (Enterprise AI Algo Trading Platform)

This document explains how automatic startup and background services work for the Enterprise AI Algo Trading Platform on Windows.

---

## 1. Overview & Architecture

When you turn on your Windows PC and log in, the application is automatically initialized in the background:
1. **PostgreSQL Database**: Starts automatically as a Windows Service (`postgresql-x64-18`).
2. **Backend (FastAPI / Uvicorn)**: Starts on port `8000` using the project's virtual environment (`backend\.venv\Scripts\python.exe`).
3. **Health Check**: Startup script polls `http://localhost:8000/health` until the backend is fully initialized.
4. **Frontend (Vite / React)**: Starts on port `5173` via `npm run dev`.
5. **Browser**: Automatically opens `http://localhost:5173` once both backend and frontend are ready.

---

## 2. Quick Control Scripts

| Script | Purpose | Double-Clickable File |
|---|---|---|
| **Start All** | Starts backend & frontend with health verification | `start-all.bat` |
| **Stop All** | Safely shuts down backend and frontend | `stop-all.bat` |
| **Status** | Inspects health, ports (8000, 5173), and memory usage | `status.bat` |
| **Enable Auto-Start** | Registers automatic startup on Windows login | `register-autostart.bat` |
| **Disable Auto-Start** | Removes automatic startup | `unregister-autostart.bat` |

---

## 3. Logs & Diagnostics

All background execution logs are maintained under the `logs/` directory:
- `logs/startup.log`: Timestamped log of startup sequence, health checks, and launch events.
- `logs/backend.log`: FastAPI / Uvicorn standard output.
- `logs/backend_err.log`: FastAPI / Uvicorn error output.
- `logs/frontend.log`: Vite standard output.
- `logs/frontend_err.log`: Vite error output.

---

## 4. Manual Development Workflow

The auto-start configuration **does not alter** your usual development workflow:
- You can still run `npm run dev` directly inside `frontend/`.
- You can still run `.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000` directly inside `backend/`.
- The startup scripts automatically detect if any service is already running on port 8000 or 5173 and prevent duplicate processes.
