.PHONY: test run dump-openapi db-up db-down db-reset migrate migrate-check-postgres api-run worker-run dev-stack frontend-smoke demo-gate

test:
	uv run --extra dev pytest

run:
	uv run uvicorn app.main:app --app-dir apps/api --reload

dump-openapi:
	uv run python apps/api/scripts/dump_openapi.py

db-up:
	docker compose up -d postgres

db-down:
	docker compose down

db-reset:
	docker compose down -v
	docker compose up -d postgres

migrate-check-postgres:
	uv run python apps/api/scripts/guard_postgres_migration_target.py

migrate: migrate-check-postgres
	uv run alembic -c apps/api/alembic.ini upgrade head

api-run:
	bash apps/api/scripts/start_api.sh

worker-run:
	bash apps/api/scripts/start_worker.sh

dev-stack:
	bash apps/api/scripts/dev_stack.sh

frontend-smoke:
	uv run python apps/api/scripts/staging_smoke.py --base-url $${MOONSHOT_API_BASE_URL:-http://127.0.0.1:8000} --tenant-id $${MOONSHOT_DEV_TENANT_ID:-tenant_local}

demo-gate:
	uv run python apps/api/scripts/staging_smoke.py --base-url $${MOONSHOT_API_BASE_URL:-http://127.0.0.1:8000} --tenant-id $${MOONSHOT_DEV_TENANT_ID:-tenant_local}
	uv run python apps/api/scripts/load_pilot.py --base-url $${MOONSHOT_API_BASE_URL:-http://127.0.0.1:8000} --tenant-id $${MOONSHOT_DEV_TENANT_ID:-tenant_local} --samples 240 --concurrency 8 --max-p95-ms 500
	uv run python apps/api/scripts/check_openapi_sync.py
	uv run python apps/api/scripts/check_frontend_contract_sync.py
	uv run python apps/api/scripts/check_api_examples.py
	uv run python apps/api/scripts/check_export_schema.py
