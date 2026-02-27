# Backend Runbook and SLOs (v0.3)

## Service Components
- API service (FastAPI)
- PostgreSQL 18
- Async task worker (`app/workers/main.py`)

## Environment
- Required: `MOONSHOT_DATABASE_URL`
- Required when provider is Gemini: `MOONSHOT_GEMINI_API_KEY`
- Optional worker lease tuning: `MOONSHOT_WORKER_LEASE_SECONDS`

## SLO Targets (Pilot)
- API availability: 99.5%
- p95 latency: <500ms for non-job-submit endpoints
- generation/score job completion: <2 minutes p95

## Startup Procedure
1. Start database.
2. Run migrations.
3. Start API and worker.
4. Verify `/health` and `/v1/meta/version`.
5. Run staging smoke E2E script.
6. Run load pilot gate (`--max-p95-ms 500`).

## Operational Validation Checklist
1. Contract governance check (`check_contract_governance.py`).
2. OpenAPI sync check (`check_openapi_sync.py`).
3. Async job lifecycle checks (`/v1/jobs*`).
4. Score drift benchmark check (`check_score_drift.py`).
5. SLO probe endpoint check (`/v1/slo/probes`).
6. Task quality endpoints smoke (`/v1/task-families/{id}/quality*`).
7. Interpretation view flow check (`/v1/reports/{session_id}/interpret*`).
8. Context trace endpoint check (`/v1/context/injection-traces/{session_id}`).
9. Fairness smoke run check (`/v1/fairness/smoke-runs*`).

## Incident Response (MVP)
- Severity definitions: SEV1/SEV2/SEV3.
- Capture timeline with request_id/job_id correlation.
- Hotfix path with rollback to prior image.
