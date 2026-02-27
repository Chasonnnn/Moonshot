# ADR 0007: Content Learning Loop (RL-Lite)

## Status
Accepted

## Context
MVP needs rapid improvement of realism and measurement quality without high-risk policy RL.

## Decision
Use a governed content loop:
1. Generate candidate task/rubric variants.
2. Evaluate quality signals (diversity, clarity, realism, leakage checks).
3. Require human review/approval before publish.
4. Iterate using acceptance, edits, and telemetry outcomes.

This is an RL-like reward loop over content selection, not model-policy optimization.

## Consequences
- Delivers most near-term value with lower governance risk.
- Keeps versioning and audit trails explicit.
- Leaves bounded RL options for post-MVP (hint selection, routing, variant sequencing).
