# Frontend/Backend Contract v0.5.1

## Integration Principles
- Frontend builds against OpenAPI `0.5.0` and fixture payloads.
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
- `current_step`

When a job result is not ready yet, `GET /v1/jobs/{job_id}/result` returns:
- `status` in `pending|running|retrying`
- `result.error_code = job_not_ready`
- `result.current_step`

Failed job results return:
- `result.error_code`
- `result.error_detail`
- `result.failed_step`

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
- `GET /v1/redteam/runs`
- `GET /v1/redteam/runs/{run_id}`
- `GET /v1/context/injection-traces/{session_id}`
- `POST /v1/fairness/smoke-runs` (async submit)
- `GET /v1/fairness/smoke-runs`
- `GET /v1/fairness/smoke-runs/{run_id}`

Run evidence fields exposed in red-team/fairness payloads:
- `created_by`
- `submitted_job_id`
- `request_id`
- `evidence_refs`
- `created_at`

Fairness list filters:
- `scope`
- `status`
- `target_session_id`
- `limit`

Red-team list filters:
- `target_type`
- `target_id`
- `status`
- `limit`

## UI Contract Requirements
- Always display scoring provenance in report views.
- Show coaching mode state clearly to candidate.
- Interpretation views must be labeled non-mutating.
- Expose request IDs for support/debug flows.
- Expose red-team/fairness run provenance in reviewer/admin evidence views.
- Show report summary diagnostics:
  - `trigger_count`
  - `last_scored_at`
- Handle coach decision diagnostics:
  - `policy_decision_code`

Employer ops pages expected in MVP:
- `/cases`
- `/cases/{id}`
- `/review-queue`
- `/reports/{sessionId}`
- `/governance`

## Implementation Playbook
- JDA integration sequence, polling cadence, and local env config:
  - `docs/08_frontend_contract/jda_integration_playbook.md`
