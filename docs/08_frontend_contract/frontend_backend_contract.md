# Frontend/Backend Contract v0.4.0

## Integration Principles
- Frontend builds against OpenAPI `0.4.0` and fixture payloads.
- Breaking changes allowed during development but must be versioned.
- Tenant-scoped APIs; explicit `404`/`403` isolation behavior.
- No fallback routes; explicit backend errors only.

## Auth and Roles
- `POST /v1/auth/token` for local bootstrap.
- Runtime bearer JWT claims: `sub`, `role`, `tenant_id`, `exp`, `kid`.

## Async Job Lifecycle
Submit endpoints return `JobAccepted`:
- `POST /v1/cases/{case_id}/generate`
- `POST /v1/sessions/{session_id}/score`
- `POST /v1/exports`
- `POST /v1/redteam/runs`
- `POST /v1/task-families/{task_family_id}/quality/evaluate`
- `POST /v1/reports/{session_id}/interpret`
- `POST /v1/fairness/smoke-runs`

Polling:
- `GET /v1/jobs`
- `GET /v1/jobs/stale-leases`
- `GET /v1/jobs/{job_id}`
- `GET /v1/jobs/{job_id}/result`

Job status diagnostics:
- `attempt_count`
- `max_attempts`
- `last_error_code`

When a job result is not ready yet, `GET /v1/jobs/{job_id}/result` returns:
- `status` in `pending|running|retrying`
- `result.error_code = job_not_ready`

Required header for async submit endpoints:
- `Idempotency-Key`

Error envelope on non-2xx responses:
- `detail`
- `error_code`
- `error_detail`
- `request_id`

Worker runtime health:
- `GET /v1/workers/health`
- Response includes `overall_status`, `workers[]`, and `stale_leases`.

Export schema lock:
- `GET /v1/exports/{run_id}` returns `schema_version` and `csv_headers`.
- Current locked export schema version: `1.0.0`.

## New Evidence-Loop Flows (v0.3)
### Co-design quality loop
- `POST /v1/task-families/{task_family_id}/quality/evaluate` (async submit)
- `GET /v1/task-families/{task_family_id}/quality`

### Coaching loop
- `POST /v1/sessions/{session_id}/mode` (`practice` / `assessment`)
- `POST /v1/sessions/{session_id}/coach/message`
- `POST /v1/sessions/{session_id}/coach/feedback`

### Evaluation interpretation loop
- `GET /v1/reports/{session_id}/summary`
- `GET /v1/reports/{session_id}`
- `POST /v1/reports/{session_id}/interpret` (async submit)
- `GET /v1/reports/{session_id}/interpretations/{view_id}`

### Governance/fairness loop
- `GET /v1/context/injection-traces/{session_id}`
- `POST /v1/fairness/smoke-runs` (async submit)
- `GET /v1/fairness/smoke-runs/{run_id}`

## UI Contract Requirements
- Always display scoring provenance in report views.
- Show coaching mode state clearly to candidate.
- Interpretation views must be labeled non-mutating.
- Expose request IDs for support/debug flows.

## Implementation Playbook
- JDA integration sequence, polling cadence, and local env config:
  - `docs/08_frontend_contract/jda_integration_playbook.md`
