# Event Schema v0.1

## Principles
- All event payloads include `event_id`, `session_id`, `event_type`, `occurred_at`, `schema_version`.
- `schema_version` is pinned to `0.1.0` for MVP.
- Derived telemetry is default; raw text fields optional and policy-gated.

## Required Event Types
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
- `session_submitted`

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

## Anti-Cheating Rules (MVP)
Flag session if any:
1. `copy_paste_detected` count exceeds policy threshold.
2. `tab_blur_detected` bursts exceed threshold window.
3. `copilot` usage without verification steps.
4. direct-answer request patterns detected in coach messages.
