# API Changelog

## 0.4.0 - 2026-02-27
- Added report summary endpoint for frontend polling cards:
  - `GET /v1/reports/{session_id}/summary`
- Bumped runtime and contract version to `0.4.0`.
- Added frontend contract sync governance check:
  - `apps/api/scripts/check_frontend_contract_sync.py`
  - CI now runs `check_frontend_contract_sync.py` in `api-ci`.
- Added JDA integration playbook with explicit token, polling, and timeout contract:
  - `docs/08_frontend_contract/jda_integration_playbook.md`.

## 0.3.1 - 2026-02-27
- Frozen frontend integration contract at OpenAPI `0.3.1`.
- Added API examples replay guard:
  - `apps/api/scripts/check_api_examples.py`
  - CI now runs `check_api_examples.py` in `api-ci`.
- Locked export response schema:
  - `schema_version`
  - `csv_headers`
  - current export schema version `1.0.0`.
- Updated MVP scope and frontend contract docs to `v0.3.1`.

## 0.3.0 - 2026-02-27
- Added co-design quality loop APIs:
  - `POST /v1/task-families/{task_family_id}/quality/evaluate`
  - `GET /v1/task-families/{task_family_id}/quality`
- Added coaching loop APIs:
  - `POST /v1/sessions/{session_id}/mode`
  - `POST /v1/sessions/{session_id}/coach/feedback`
- Added evaluation interpretation APIs:
  - `POST /v1/reports/{session_id}/interpret`
  - `GET /v1/reports/{session_id}/interpretations/{view_id}`
- Added context trace API:
  - `GET /v1/context/injection-traces/{session_id}`
- Added fairness smoke run APIs:
  - `POST /v1/fairness/smoke-runs`
  - `GET /v1/fairness/smoke-runs/{run_id}`
- Converted v0.3 heavy operations to async submit (`202` + `JobAccepted`):
  - `POST /v1/task-families/{task_family_id}/quality/evaluate`
  - `POST /v1/reports/{session_id}/interpret`
  - `POST /v1/fairness/smoke-runs`
- Enforced `Idempotency-Key` on new async submit endpoints.
- Added worker job types:
  - `quality_evaluate`
  - `interpretation_generate`
  - `fairness_smoke_run`
- Added Postgres-backed persistence for v0.3 entities:
  - `task_quality_signals`
  - `coach_feedback`
  - `interpretation_views`
  - `context_injection_traces`
  - `fairness_smoke_runs`
- Added strict release-gate CI job with Postgres migration gate + staging smoke + load gate.
- Added managed-secrets startup validation settings for enterprise deployments.
- Added machine-readable error envelope fields on API errors:
  - `error_code`
  - `error_detail`
  - `request_id`
- Added async job diagnostics fields:
  - `attempt_count`
  - `max_attempts`
  - `last_error_code`
- Job result polling now returns explicit not-ready payload for incomplete jobs:
  - `error_code=job_not_ready`
- Updated policy defaults: `default_retention_ttl_days=90`.
- Added queue runtime probe in SLO endpoint:
  - `probes.queue_runtime.detail.queue_backlog_count`
  - `probes.queue_runtime.detail.queue_oldest_pending_age_seconds`
  - `probes.queue_runtime.detail.queue_retrying_count`
  - `probes.queue_runtime.detail.queue_failed_permanent_count`
  - `probes.queue_runtime.detail.queue_inflight_leased_count`
- Added job stale-lease inspector endpoint:
  - `GET /v1/jobs/stale-leases`
- Added worker health endpoint:
  - `GET /v1/workers/health`
- Added coach policy hash propagation:
  - `CoachResponse.policy_hash`
  - `ContextInjectionTrace.policy_hash`
  - `audit.metadata.policy_hash` for coach actions
- Added scorer audit metadata enrichment:
  - `audit.metadata.model_hash`
- Added Postgres-only migration guardrails:
  - Alembic env now rejects SQLite URLs with explicit failure message.
  - startup and CI migration gates run `guard_postgres_migration_target.py`.
- Added new domain types:
  - `TaskQualitySignal`
  - `CoachFeedback`
  - `InterpretationView`
  - `ScoringVersionLock`
  - `ContextInjectionTrace`
  - `FairnessSmokeRun`
- Added evaluator/coach context trace writes for auditability.
- Updated documentation baseline to evidence-loop MVP model.

## 0.2.0 - 2026-02-27
- Added JWT bootstrap token API:
  - `POST /v1/auth/token`
- Added async job lifecycle APIs:
  - `GET /v1/jobs`
  - `GET /v1/jobs/{job_id}`
  - `GET /v1/jobs/{job_id}/result`
- Added SLO probe endpoint:
  - `GET /v1/slo/probes`
- Converted heavy operations to async submit with `JobAccepted` response (`202`):
  - `POST /v1/cases/{case_id}/generate`
  - `POST /v1/sessions/{session_id}/score`
  - `POST /v1/exports`
  - `POST /v1/redteam/runs`
- Enforced idempotency headers for async submit endpoints.
- Replaced header-spoof auth runtime behavior with JWT bearer-token claims (`sub`, `role`, `tenant_id`, `exp`, `kid`).
- Added job retry/dead-letter states and backoff metadata (`next_attempt_at`) in job status.
- Added worker lease metadata (`lease_owner`, `lease_expires_at`) and lease-based reclaim behavior.
- Added policy metadata to coach responses (`policy_version`, `blocked_rule_id`).
- Added score diagnostics (`trigger_codes`) and maintained provenance fields for reports.
- Added model-provider abstraction layer with explicit no-fallback behavior for unsupported providers.
- Wired Gemini provider to the live Gemini SDK (`google-genai`) with explicit API-key requirement (`MOONSHOT_GEMINI_API_KEY`).
- Added audit integrity chain fields (`prev_hash`, `entry_hash`) and verification endpoint:
  - `GET /v1/audit-logs/verify`
- Added CI governance checks:
  - OpenAPI/changelog version gate
  - scoring drift benchmark gate
- Added request ID middleware:
  - `X-Request-Id` returned on API responses
  - structured request completion/failure logs include `request_id`.

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
