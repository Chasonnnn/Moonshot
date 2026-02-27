# Event Schema v0.2

## Principles
- Every event includes: `event_id`, `session_id`, `event_type`, `occurred_at`, `schema_version`.
- `schema_version` is pinned to `0.2.0`.
- Derived telemetry is default; raw content is opt-in and retention-policy bound.
- No fallback ingestion paths: invalid event payloads return explicit validation errors.

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
- `session_submitted`

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
- `time_to_submit_ms`
- `query_attempt_count`
- `query_error_rate`
- `ai_prompt_count`
- `ai_accept_ratio`
- `ai_edit_distance_ratio`
- `verification_steps`
- `policy_violation_flags`
- `policy_version`
- `blocked_rule_id`
- `job_id`
- `job_type`
- `job_status`
- `next_attempt_at`
- `lease_owner`
- `lease_expires_at`

## Anti-Cheating Rules (MVP)
Flag session if any:
1. `copy_paste_detected` count exceeds policy threshold.
2. `tab_blur_detected` bursts exceed threshold window.
3. `copilot` usage without `verification_step_completed`.
4. direct-answer request patterns are blocked by coach policy.

## Scoring Evidence Linkage
- `ScoreResult.objective_metrics` is computed deterministically from session events.
- `ScoreResult.trigger_codes` must map to event-derived conditions.
- Reports must retain scorer provenance:
  - `task_family_version`
  - `rubric_version`
  - `scorer_version`
  - `model_hash`
