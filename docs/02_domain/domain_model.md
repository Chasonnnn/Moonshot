# Domain Model v0.3

## Core Entities

### BusinessContextPack
- `id`, `tenant_id`
- `name`, `role_focus`, `job_description`
- `examples`, `constraints`
- `status` (`draft`, `review`, `approved`)
- `created_at`, `updated_at`

### CaseSpec
- `id`, `tenant_id`, `context_pack_id`
- `title`, `scenario`
- `artifacts`, `metrics`, `allowed_tools`
- `status` (`draft`, `review`, `approved`, `published`)
- `version`

### TaskFamily
- `id`, `case_id`, `rubric_id`
- `variants` (array[TaskVariant])
- `status` (`generated`, `review`, `approved`, `published`, `retired`)
- `version`

### Rubric
- `id`, `dimensions`, `failure_modes`, `version`

### TaskQualitySignal
- `task_family_id`
- `variant_count`, `diversity_score`, `clarity_score`, `realism_score`
- `variant_stability_score`
- `admin_acceptance_rate`, `mean_edit_distance`
- `rubric_leakage_detected`, `quality_score`
- `evaluated_at`, `evaluated_by_role`

### Session
- `id`, `tenant_id`, `task_family_id`, `candidate_id`
- `status` (`active`, `submitted`, `scored`)
- `policy` (contains retention + `coach_mode`)
- `final_response`
- `created_at`, `updated_at`

### CoachFeedback
- `id`, `session_id`, `candidate_id`
- `helpful`, `confusion_tags`, `notes`
- `created_at`

### EventLog
- `id`, `session_id`, `event_type`, `payload`, `created_at`

### ScoreResult
- `id`, `session_id`
- `dimension_scores`, `objective_metrics`
- `confidence`, `needs_human_review`
- `trigger_codes`
- provenance: `scorer_version`, `rubric_version`, `task_family_version`, `model_hash`

### EvaluationInterpretation
- base report interpretation remains reviewer/admin-only

### InterpretationView
- `view_id`, `session_id`
- `focus_dimensions`, `include_sensitivity`, `weight_overrides`
- `breakdown`, `caveats`
- `scoring_version_lock`
- `created_at`

### ContextInjectionTrace
- `id`, `session_id`, `tenant_id`
- `agent_type`, `actor_role`, `mode`
- `context_keys`, `precedence_order`
- `policy_version`, `created_at`

### FairnessSmokeRun
- `id`, `tenant_id`, `scope`, `status`
- `summary`
- `created_at`

### JobRun / JobAttempt
- unchanged lifecycle with retry, lease, and dead-letter support

### RedTeamRun
- unchanged target + findings model

### AuditLog
- unchanged hash-chain model (`prev_hash`, `entry_hash`)

## Status Transition Rules
- `CaseSpec`: `draft -> review -> approved -> published`
- `TaskFamily`: `generated -> review -> approved -> published -> retired`
- `Session`: `active -> submitted -> scored`

## Versioning Rules
Every report and interpretation must include scoring provenance:
- `task_family_version`
- `rubric_version`
- `scorer_version`
- `model_hash`
