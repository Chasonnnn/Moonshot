# Scoring And Interpretation Spec v0.2

## Scoring Architecture
Hybrid scoring pipeline:
1. Deterministic rules metrics from telemetry.
2. Rubric dimension scoring by judge component.
3. Review trigger evaluation.

## Rules Metrics (Examples)
- `time_to_first_action`
- `query_error_rate`
- `verification_completeness`
- `policy_violation_count`

## Rubric Dimensions (JDA)
- Problem framing
- SQL correctness and iteration quality
- Evidence-based reasoning
- Communication and caveat handling

## Confidence and Human Review
`needs_human_review = true` when any:
- confidence < 0.70
- conflicting dimension signals
- high coach dependency and weak independent evidence
- near-threshold decision boundary

`trigger_codes` must be emitted for machine-readable diagnostics (for example: `low_confidence`, `policy_violation`, `high_ai_low_verification`).

## Interpretation Output
Audience: reviewer/admin only.
Required fields:
- score summary
- top strengths
- top risks
- structured follow-up suggestions
- caveat/disclaimer text

## Provenance
Reports must include:
- `task_family_version`
- `rubric_version`
- `scorer_version`
- `model_hash`
