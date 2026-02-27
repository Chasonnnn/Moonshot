# Frontend/Backend Contract v0.2

## Integration Principles
- Frontend builds against OpenAPI `0.2.0` plus fixture payloads.
- Breaking changes are allowed during development but must be versioned in changelog.
- APIs are tenant-scoped; cross-tenant resources return `404` or `403` per endpoint policy.
- No fallback routes: backend returns explicit error states for invalid payloads and policy violations.

## Auth And Role Model
- Bootstrap token minting: `POST /v1/auth/token` with `X-Bootstrap-Token`.
- Runtime auth: `Authorization: Bearer <jwt>`.
- JWT claims used by backend:
  - `sub`
  - `role` (`org_admin`, `reviewer`, `candidate`)
  - `tenant_id`
  - `exp`
  - `kid`

## Async Job Lifecycle Contract
- Async submit endpoints return `JobAccepted`:
  - `POST /v1/cases/{case_id}/generate`
  - `POST /v1/sessions/{session_id}/score`
  - `POST /v1/exports`
  - `POST /v1/redteam/runs`
- Required header for async submit endpoints: `Idempotency-Key`.
- Polling endpoints:
  - `GET /v1/jobs/{job_id}` -> `JobStatus`
  - `GET /v1/jobs/{job_id}/result` -> `JobResultResponse` (returns in-progress status explicitly)
- Job states:
  - `pending`
  - `running`
  - `retrying`
  - `completed`
  - `failed_permanent`

## Required Mocking Assets
- OpenAPI spec: `docs/03_api/openapi.yaml`
- API examples: `apps/api/fixtures/api_examples.json`
- Seeded scenario fixtures: `apps/api/fixtures/jda_seed_scenarios.json`
- Event schema: `docs/04_events/event_schema.md`

## Frontend First-Phase Flows
- Case create/edit:
  - `POST /v1/cases`
  - `PATCH /v1/cases/{case_id}`
- Generate submit/poll/result:
  - `POST /v1/cases/{case_id}/generate`
  - `GET /v1/jobs/{job_id}`
  - `GET /v1/jobs/{job_id}/result`
- Session runtime:
  - `POST /v1/sessions`
  - `POST /v1/sessions/{session_id}/events`
  - `POST /v1/sessions/{session_id}/coach/message`
  - `POST /v1/sessions/{session_id}/submit`
- Score submit/poll/result:
  - `POST /v1/sessions/{session_id}/score`
  - `GET /v1/jobs/{job_id}`
  - `GET /v1/jobs/{job_id}/result`
- Report/export:
  - `GET /v1/reports/{session_id}`
  - `POST /v1/exports`
  - `GET /v1/exports/{run_id}`

## Review And Governance Flows
- Task family review/publish:
  - `POST /v1/task-families/{task_family_id}/review`
  - `POST /v1/task-families/{task_family_id}/publish`
- Review queue:
  - `GET /v1/review-queue`
  - `GET /v1/review-queue/{session_id}`
  - `POST /v1/review-queue/{session_id}/resolve`
- Admin and audit:
  - `GET /v1/admin/policies`
  - `PATCH /v1/admin/policies`
  - `POST /v1/admin/policies/purge-expired`
  - `GET /v1/audit-logs`
