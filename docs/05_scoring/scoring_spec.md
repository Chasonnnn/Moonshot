# Scoring And Interpretation Spec v0.3

## Architecture
Two-layer evaluation model:
1. **Scoring Engine (stable)**
2. **Interpretation Engine (flexible)**

## Scoring Engine (Stable + Auditable)
Pipeline:
1. Deterministic rules metrics from telemetry.
2. Rubric dimension scoring.
3. Review trigger evaluation.

Rules:
- Scoring definitions are immutable per scoring version.
- Score outputs are not mutated by interpretation requests.
- Any scoring-definition change requires explicit version bump.

### Rules Metrics (Examples)
- `time_to_first_action_ms`
- `query_error_rate`
- `verification_steps`
- `policy_violation_count`

### Review Triggers
`needs_human_review = true` when any:
- confidence < 0.70
- conflicting dimension signals
- policy violations
- high AI reliance with weak verification

`trigger_codes` are mandatory and machine-readable.

## Interpretation Engine (Flexible)
Interpretation requests can provide:
- targeted dimension breakdowns
- evidence highlights
- failure-mode matching
- optional sensitivity analysis (`weight_overrides`)

Interpretation outputs must include:
- caveats that interpretation is non-mutating
- `scoring_version_lock`

## Calibration and Reliability Loop
Required checks:
- benchmark replay stability
- variant stability checks
- inter-rater alignment samples
- drift checks across model/prompt version changes

## Provenance Requirements
Every report/interpretation must include:
- `task_family_version`
- `rubric_version`
- `scorer_version`
- `model_hash`
