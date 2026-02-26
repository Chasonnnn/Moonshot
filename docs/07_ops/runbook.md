# Backend Runbook and SLOs

## Service Components
- API service (FastAPI)
- Postgres
- Async task queue (planned, stubbed for MVP baseline)

## SLO Targets (Pilot)
- API availability: 99.5%
- p95 endpoint latency: < 500ms for non-generation endpoints
- generation/score job completion: < 2 minutes p95

## Operational Procedures
1. Deploy new schema migration.
2. Verify `/health` and `/v1/meta/version`.
3. Run contract tests.
4. Validate event ingestion and export paths.

## Incident Response (MVP)
- Severity definitions: SEV1/SEV2/SEV3.
- Capture incident timeline in audit channel.
- Hotfix path with rollback to prior app image.
