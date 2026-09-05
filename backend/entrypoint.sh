#!/bin/sh
set -e

echo "=== [1/2] Running Alembic Database Migrations ==="
alembic upgrade head || {
    echo "Migration failed, check database connectivity."
    exit 1
}

echo "=== [2/2] Starting Enterprise Quant Engine (Gunicorn + Uvicorn) ==="
exec gunicorn app.main:app -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 --workers 2 --timeout 120 --access-logfile - --error-logfile -
