#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
API_DIR="$ROOT_DIR/apps/api"
cd "$ROOT_DIR"

: "${MOONSHOT_DATABASE_URL:?MOONSHOT_DATABASE_URL must be set}"

uv run python apps/api/scripts/validate_runtime_env.py
uv run python apps/api/scripts/guard_postgres_migration_target.py
(cd "$API_DIR" && uv run alembic -c alembic.ini upgrade head)
exec uv run uvicorn app.main:app --app-dir apps/api --host "${HOST:-0.0.0.0}" --port "${PORT:-8000}"
