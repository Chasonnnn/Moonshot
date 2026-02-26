# ADR 0002: Agent Topology

## Status
Accepted

## Context
MVP requires three agent roles (co-design, coach, evaluation) without overloading delivery complexity.

## Decision
Implement a single orchestrator service with strict role isolation and policy checks.

## Consequences
- Faster MVP delivery than service-per-agent.
- Requires strong internal policy enforcement and auditability.
- Supports post-MVP split into separate services if needed.
