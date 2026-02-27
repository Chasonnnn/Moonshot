# Frontend/Backend Contract v0.3

## Integration Principles
- Frontend builds against OpenAPI `0.3.0` and fixture payloads.
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
- `GET /v1/jobs/{job_id}`
- `GET /v1/jobs/{job_id}/result`

Required header for async submit endpoints:
- `Idempotency-Key`

## New Evidence-Loop Flows (v0.3)
### Co-design quality loop
- `POST /v1/task-families/{task_family_id}/quality/evaluate` (async submit)
- `GET /v1/task-families/{task_family_id}/quality`

### Coaching loop
- `POST /v1/sessions/{session_id}/mode` (`practice` / `assessment`)
- `POST /v1/sessions/{session_id}/coach/message`
- `POST /v1/sessions/{session_id}/coach/feedback`

### Evaluation interpretation loop
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
