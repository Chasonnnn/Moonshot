# Backend Runbook and SLOs

## Service Components
- API service (FastAPI)
- PostgreSQL 18
- Async task queue (planned, stubbed for MVP baseline)

## Environment
- Required: `MOONSHOT_DATABASE_URL`
- Example: `postgresql+psycopg://moonshot:moonshot@localhost:5432/moonshot`

## SLO Targets (Pilot)
- API availability: 99.5%
- p95 endpoint latency: < 500ms for non-generation endpoints
- generation/score job completion: < 2 minutes p95

## Startup Procedure
1. Start database: `docker compose up -d postgres`.
2. Start API with migration gate: `apps/api/scripts/start_api.sh`.
3. Verify health/version endpoints: `/health`, `/v1/meta/version`.

## Operational Procedures
1. Apply schema migration (`alembic upgrade head`) before serving traffic.
2. Verify contract tests and smoke tests.
3. Validate event ingestion, scoring, report, and export paths.
4. Verify audit log and red-team APIs are reachable.

## Incident Response (MVP)
- Severity definitions: SEV1/SEV2/SEV3.
- Capture incident timeline in audit channel.
- Hotfix path with rollback to prior app image.
