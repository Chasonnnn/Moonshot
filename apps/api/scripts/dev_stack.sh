#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

uv run python apps/api/scripts/validate_runtime_env.py
uv run python apps/api/scripts/guard_postgres_migration_target.py
uv run alembic -c apps/api/alembic.ini upgrade head

uv run uvicorn app.main:app --app-dir apps/api --host "${HOST:-0.0.0.0}" --port "${PORT:-8000}" &
API_PID=$!
uv run python -m app.workers.main &
WORKER_PID=$!

cleanup() {
  kill "${API_PID}" "${WORKER_PID}" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM
wait "${API_PID}" "${WORKER_PID}"
