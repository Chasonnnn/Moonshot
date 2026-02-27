# Backend Runbook and SLOs

## Service Components
- API service (FastAPI)
- PostgreSQL 18
- Postgres-backed async task queue worker (`app/workers/main.py`)

## Environment
- Required: `MOONSHOT_DATABASE_URL`
- Example: `postgresql+psycopg://moonshot:moonshot@localhost:5432/moonshot`
- Required when `MOONSHOT_MODEL_PROVIDER=gemini`: `MOONSHOT_GEMINI_API_KEY`

## SLO Targets (Pilot)
- API availability: 99.5%
- p95 endpoint latency: < 500ms for non-generation endpoints
- generation/score job completion: < 2 minutes p95

## Startup Procedure
1. Start database: `docker compose up -d postgres`.
2. Start API with migration gate: `apps/api/scripts/start_api.sh`.
3. Start worker: `cd apps/api && uv run python -m app.workers.main`.
4. Verify health/version endpoints: `/health`, `/v1/meta/version`.

## Operational Procedures
1. Apply schema migration (`alembic upgrade head`) before serving traffic.
2. Verify contract tests and smoke tests.
3. Validate async job paths (`/v1/jobs/{job_id}`, `/v1/jobs/{job_id}/result`) for generate/score/export/red-team jobs.
4. Validate event ingestion, scoring, report, and export paths.
5. Verify audit log and red-team APIs are reachable.

## Incident Response (MVP)
- Severity definitions: SEV1/SEV2/SEV3.
- Capture incident timeline in audit channel.
- Hotfix path with rollback to prior app image.
