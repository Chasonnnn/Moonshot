# Event Schema v0.3

## Principles
- Every event includes: `event_id`, `session_id`, `event_type`, `occurred_at`, `schema_version`.
- `schema_version` is pinned to `0.3.0`.
- Derived telemetry is default; raw content is opt-in and retention-policy bound.
- No fallback ingestion paths: invalid payloads return explicit validation errors.
- API responses include `X-Request-Id` for traceability.

## Required Session Event Types
- `session_started`
- `checkpoint_saved`
- `tab_blur_detected`
- `copy_paste_detected`
- `idle_spike_detected`
- `sql_query_run`
- `sql_query_error`
- `dashboard_filter_applied`
- `copilot_invoked`
- `copilot_output_accepted`
- `copilot_output_edited`
- `verification_step_completed`
- `coach_message`
- `coach_blocked`
- `coach_feedback_rated`
- `session_submitted`

## Required Content/Governance Event Types
- `task_quality_scored`
- `task_candidate_ranked`
- `content_publish_blocked`
- `interpretation_requested`
- `context_injection_traced`
- `fairness_smoke_executed`

## Required Job Lifecycle Event Types
- `job_submitted`
- `job_started`
- `job_retry_scheduled`
- `job_completed`
- `job_failed_permanent`
- `job_lease_claimed`
- `job_lease_reclaimed`

## Canonical Payload Keys
- `time_to_first_action_ms`
- `query_attempt_count`
- `query_error_rate`
- `ai_prompt_count`
- `ai_accept_ratio`
- `verification_steps`
- `policy_violation_flags`
- `policy_version`
- `blocked_rule_id`
- `coach_mode`
- `context_keys`
- `precedence_order`
- `job_id`, `job_type`, `job_status`
- `next_attempt_at`, `lease_owner`, `lease_expires_at`

## Anti-Cheating Rules (MVP)
Flag session if any:
1. `copy_paste_detected` bursts exceed threshold.
2. `tab_blur_detected` bursts exceed threshold window.
3. Copilot usage without verification evidence.
4. Assessment-mode direct-answer requests are blocked.

## Scoring Evidence Linkage
- `ScoreResult.objective_metrics` is deterministic from session events.
- `ScoreResult.trigger_codes` must map to event-derived conditions.
- Reports and interpretation views retain provenance:
  - `task_family_version`
  - `rubric_version`
  - `scorer_version`
  - `model_hash`
