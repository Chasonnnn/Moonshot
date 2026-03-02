#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
API_DIR="$ROOT_DIR/apps/api"
cd "$ROOT_DIR"

uv run python apps/api/scripts/validate_runtime_env.py
uv run python apps/api/scripts/guard_postgres_migration_target.py
exec /bin/zsh -lc "cd \"$API_DIR\" && uv run python -m app.workers.main"
