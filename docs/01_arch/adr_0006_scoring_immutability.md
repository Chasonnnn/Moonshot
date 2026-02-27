# ADR 0006: Scoring Immutability and Interpretation Flexibility

## Status
Accepted

## Context
Admins need deeper insights and sensitivity views without losing trust in score stability.

## Decision
Freeze scoring semantics per version and separate interpretation generation into a distinct layer.

Rules:
- Scoring engine outputs are immutable for a pinned scoring version.
- Interpretation views may vary by request parameters but must include a scoring version lock.
- Interpretation endpoints cannot mutate persisted score records.

## Consequences
- Prevents silent metric drift and moving-goalpost behavior.
- Supports richer admin analytics without compromising auditability.
- Requires explicit version bumps for scoring-definition changes.
