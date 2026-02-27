# ADR 0002: Agent Topology and Shared Context

## Status
Accepted

## Context
MVP requires three role-isolated agent behaviors (co-design, coach, evaluator) while preserving delivery velocity and governance controls.

## Decision
Implement a single backend orchestrator with strict role isolation and a typed shared Business Context layer.

Agent roles:
1. Co-design agent (admin/reviewer-facing)
2. Coaching agent (candidate-facing, mode-separated)
3. Evaluator agent (system/reviewer-facing)

Shared context must be injected by precedence:
1. Task and rubric
2. Org policy constraints
3. Role competency profile
4. Learner progress notes (practice mode only)
5. Aggregated long-term insights

## Consequences
- Faster MVP delivery than service-per-agent split.
- Strong policy/audit controls are mandatory.
- Enables post-MVP decomposition into independent services without API contract reset.
