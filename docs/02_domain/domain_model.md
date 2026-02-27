# Domain Model v0.2

## Core Entities

### BusinessContextPack
- `id` (uuid)
- `tenant_id` (string)
- `name` (string)
- `role_focus` (enum: `junior_data_analyst`, `customer_support`)
- `job_description` (text)
- `examples` (array[string])
- `constraints` (object)
- `status` (enum: `draft`, `review`, `approved`)
- `created_at`, `updated_at`

### CaseSpec
- `id`, `tenant_id`, `context_pack_id`
- `title`, `scenario`
- `artifacts` (array[object])
- `metrics` (array[MetricSpec])
- `allowed_tools` (array[string])
- `status` (enum: `draft`, `review`, `approved`, `published`)
- `version` (string)

### MetricSpec
- `key`
- `description`
- `formula`
- `source_events` (array[string])
- `thresholds` (object)

### TaskFamily
- `id`, `case_id`
- `variants` (array[TaskVariant])
- `rubric_id`
- `status` (enum: `generated`, `review`, `published`)
- `version`

### Rubric
- `id`
- `dimensions` (array[RubricDimension])
- `failure_modes` (array[string])
- `version`

### ScoringConfig
- `id`
- `rules_version`
- `judge_prompt_version`
- `review_threshold`
- `dual_approval_required` (bool)

### Session
- `id`, `tenant_id`
- `task_family_id`
- `candidate_id`
- `policy` (object)
- `status` (enum: `active`, `submitted`, `scored`)

### EventLog
- `id`, `session_id`
- `event_type`
- `payload` (json)
- `created_at`

### ScoreResult
- `id`, `session_id`
- `dimension_scores` (json)
- `objective_metrics` (json)
- `confidence` (float)
- `needs_human_review` (bool)
- `trigger_codes` (array[string])

### JobRun
- `id`, `tenant_id`, `created_by`
- `job_type`, `target_type`, `target_id`
- `status` (enum: `pending`, `running`, `retrying`, `completed`, `failed_permanent`)
- `request_payload`, `result_payload`
- `error_code`, `error_detail`
- `attempt_count`, `max_attempts`
- `idempotency_scope`, `idempotency_key`
- `created_at`, `started_at`, `completed_at`, `next_attempt_at`

### JobAttempt
- `id`, `job_id`, `attempt_no`
- `status` (enum: `running`, `completed`, `failed`)
- `error_code`, `error_detail`
- `started_at`, `completed_at`

### EvaluationInterpretation
- `id`, `score_result_id`
- `summary`
- `suggestions` (array[string])
- `audience` (enum: `reviewer_admin_only`)

### RedTeamRun
- `id`, `target_type`, `target_id`
- `status`
- `findings` (array[object])

### AuditLog
- `id`, `tenant_id`, `actor_role`
- `action`, `resource_type`, `resource_id`
- `metadata` (json)
- `created_at`

## Status Transition Rules
- `CaseSpec`: `draft -> review -> approved -> published`
- `TaskFamily`: `generated -> review -> published`
- `Session`: `active -> submitted -> scored`

## Versioning Rules
Every report must include:
- task family version
- rubric version
- scorer version
- model hash (when model-backed scoring is used)
