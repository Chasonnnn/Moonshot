#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

: "${MOONSHOT_DATABASE_URL:?MOONSHOT_DATABASE_URL must be set}"

uv run alembic -c apps/api/alembic.ini upgrade head
exec uv run uvicorn app.main:app --app-dir apps/api --host "${HOST:-0.0.0.0}" --port "${PORT:-8000}"
