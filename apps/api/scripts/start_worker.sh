#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
API_DIR="$ROOT_DIR/apps/api"
cd "$ROOT_DIR"

# Load local runtime env when launching worker directly.
if [[ -f "$API_DIR/.env.local" ]]; then
  set -a
  source "$API_DIR/.env.local"
  set +a
elif [[ -f "$API_DIR/.env" ]]; then
  set -a
  source "$API_DIR/.env"
  set +a
fi

uv run python apps/api/scripts/validate_runtime_env.py
uv run python apps/api/scripts/guard_postgres_migration_target.py
exec /bin/zsh -lc "cd \"$API_DIR\" && uv run python -m app.workers.main"
