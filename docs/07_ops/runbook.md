# Backend Runbook and SLOs (v0.5.1)

## Service Components
- API service (FastAPI)
- PostgreSQL 18
- Async task worker (`app/workers/main.py`)

## Environment
- Required: `MOONSHOT_DATABASE_URL`
- Required when provider is LiteLLM:
  - `MOONSHOT_LITELLM_BASE_URL`
  - `MOONSHOT_LITELLM_API_KEY`
- Optional worker lease tuning: `MOONSHOT_WORKER_LEASE_SECONDS`
- Optional worker heartbeat tuning:
  - `MOONSHOT_WORKER_HEARTBEAT_INTERVAL_SECONDS`
  - `MOONSHOT_WORKER_STALE_AFTER_SECONDS`
- Optional managed-secrets mode:
  - `MOONSHOT_MANAGED_SECRETS_ENABLED`
  - `MOONSHOT_MANAGED_SECRETS_REQUIRED`
  - `MOONSHOT_MANAGED_SECRETS_REGION`
  - `MOONSHOT_JWT_SIGNING_KEYS_SECRET_ID`

## SLO Targets (Pilot)
- API availability: 99.5%
- p95 latency: <500ms for non-job-submit endpoints
- generation/score job completion: <2 minutes p95

## Startup Procedure
1. Start database.
2. Validate runtime env (`validate_runtime_env.py`).
3. Run migrations (PostgreSQL targets only; SQLite migration targets are rejected by guard).
4. Start API and worker.
5. Verify `/health` and `/v1/meta/version`.
6. Run staging smoke E2E script.
7. Run load pilot gate (`--max-p95-ms 500`).

## Operational Validation Checklist
1. Contract governance check (`check_contract_governance.py`).
2. OpenAPI sync check (`check_openapi_sync.py`).
3. Frontend contract sync check (`check_frontend_contract_sync.py`).
4. API examples contract check (`check_api_examples.py`).
5. Report summary consistency check (`check_report_summary_consistency.py`).
6. Export schema lock check (`check_export_schema.py`).
7. Async job lifecycle checks (`/v1/jobs*`).
8. Score drift benchmark check (`check_score_drift.py`).
9. SLO probe endpoint check (`/v1/slo/probes`).
10. Worker health endpoint check (`/v1/workers/health`).
11. Stale lease endpoint check (`/v1/jobs/stale-leases`).
12. Task quality endpoints smoke (`/v1/task-families/{id}/quality*`).
13. Report summary contract check (`/v1/reports/{session_id}/summary`).
14. Interpretation view flow check (`/v1/reports/{session_id}/interpret*`).
15. Context trace endpoint check (`/v1/context/injection-traces/{session_id}`).
16. Fairness smoke run checks (`POST /v1/fairness/smoke-runs`, `GET /v1/fairness/smoke-runs`, `GET /v1/fairness/smoke-runs/{run_id}`).
17. CI strict release-gate job must pass:
  - Postgres migration gate
  - staging smoke gate
  - load gate

## Incident Response (MVP)
- Severity definitions: SEV1/SEV2/SEV3.
- Capture timeline with request_id/job_id correlation.
- Hotfix path with rollback to prior image.
