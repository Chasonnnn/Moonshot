# Backend Runbook and SLOs

## Service Components
- API service (FastAPI)
- PostgreSQL 18
- Postgres-backed async task queue worker (`app/workers/main.py`)

## Environment
- Required: `MOONSHOT_DATABASE_URL`
- Example: `postgresql+psycopg://moonshot:moonshot@localhost:5432/moonshot`
- Required when `MOONSHOT_MODEL_PROVIDER=gemini`: `MOONSHOT_GEMINI_API_KEY`
- Optional worker lease tuning: `MOONSHOT_WORKER_LEASE_SECONDS` (default `30`)

## SLO Targets (Pilot)
- API availability: 99.5%
- p95 endpoint latency: < 500ms for non-generation endpoints
- generation/score job completion: < 2 minutes p95

## Startup Procedure
1. Start database: `docker compose up -d postgres`.
2. Start API with migration gate: `apps/api/scripts/start_api.sh`.
3. Start worker: `cd apps/api && uv run python -m app.workers.main`.
4. Verify health/version endpoints: `/health`, `/v1/meta/version`.
5. Run staging smoke check (local/staging URL): `uv run python apps/api/scripts/staging_smoke.py --base-url http://localhost:8000`.

## Operational Procedures
1. Apply schema migration (`alembic upgrade head`) before serving traffic.
2. Verify contract tests and smoke tests.
3. Validate async job paths (`/v1/jobs`, `/v1/jobs/{job_id}`, `/v1/jobs/{job_id}/result`) for generate/score/export/red-team jobs.
4. Validate event ingestion, scoring, report, and export paths.
5. Verify audit log APIs including chain verification (`/v1/audit-logs`, `/v1/audit-logs/verify`).
6. Run score drift benchmark check (`uv run python apps/api/scripts/check_score_drift.py`).
7. Verify SLO probe endpoint (`/v1/slo/probes`) with org admin token.

## Incident Response (MVP)
- Severity definitions: SEV1/SEV2/SEV3.
- Capture incident timeline in audit channel.
- Hotfix path with rollback to prior app image.
