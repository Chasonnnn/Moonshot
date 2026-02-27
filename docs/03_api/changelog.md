# API Changelog

## 0.2.0 - 2026-02-27
- Added JWT bootstrap token API:
  - `POST /v1/auth/token`
- Added async job lifecycle APIs:
  - `GET /v1/jobs/{job_id}`
  - `GET /v1/jobs/{job_id}/result`
- Converted heavy operations to async submit with `JobAccepted` response (`202`):
  - `POST /v1/cases/{case_id}/generate`
  - `POST /v1/sessions/{session_id}/score`
  - `POST /v1/redteam/runs`
- Enforced idempotency headers for async submit endpoints.
- Replaced header-spoof auth runtime behavior with JWT bearer-token claims (`sub`, `role`, `tenant_id`, `exp`, `kid`).
- Added job retry/dead-letter states and backoff metadata (`next_attempt_at`) in job status.
- Added policy metadata to coach responses (`policy_version`, `blocked_rule_id`).
- Added score diagnostics (`trigger_codes`) and maintained provenance fields for reports.
- Added model-provider abstraction layer with explicit no-fallback behavior for unsupported providers.

## 0.1.4 - 2026-02-26
- Added simulator runtime endpoints:
  - `POST /v1/sessions/{session_id}/sql/run`
  - `GET /v1/sessions/{session_id}/sql/history`
  - `GET /v1/sessions/{session_id}/dashboard/state`
  - `POST /v1/sessions/{session_id}/dashboard/action`
- Added explicit SQL safety validation for disallowed query operations.
- Added dashboard state/action event capture for process evidence.

## 0.1.3 - 2026-02-26
- Added admin policy endpoints:
  - `GET /v1/admin/policies`
  - `PATCH /v1/admin/policies`
  - `POST /v1/admin/policies/purge-expired`
- Session creation now enforces tenant policy defaults for retention settings.
- Added TTL purge flow for raw candidate responses with optional dry-run mode.
- Session schema now includes optional `final_response`.

## 0.1.2 - 2026-02-26
- Added task family review workflow endpoint:
  - `POST /v1/task-families/{task_family_id}/review`
- Enforced publish gating: task families must be `approved` before publish.
- Added reviewer queue APIs for human-review sessions:
  - `GET /v1/review-queue`
  - `GET /v1/review-queue/{session_id}`
  - `POST /v1/review-queue/{session_id}/resolve`
- Scoring now enqueues `needs_human_review=true` sessions into tenant-scoped review queue.

## 0.1.1 - 2026-02-26
- Added tenant-scoped read endpoints for frontend bootstrap:
  - `GET /v1/business-context/packs`
  - `GET /v1/business-context/packs/{pack_id}`
  - `GET /v1/cases`
  - `GET /v1/cases/{case_id}`
  - `GET /v1/task-families`
  - `GET /v1/task-families/{task_family_id}`
  - `GET /v1/sessions`
  - `GET /v1/sessions/{session_id}`
- Added strict tenant isolation checks to read/write flows.
- Namespaced idempotency cache by tenant for generate/score/red-team endpoints.
- Enabled CORS for local frontend origins (`http://localhost:3000`, `http://localhost:3001`).

## 0.1.0 - 2026-02-26
- Initial endpoint set for backend-first MVP.
- Added business context, case, generation, session, coach, scoring, reporting, export, red-team, and audit endpoints.
- Added RBAC role policy baseline (`org_admin`, `reviewer`, `candidate`).
