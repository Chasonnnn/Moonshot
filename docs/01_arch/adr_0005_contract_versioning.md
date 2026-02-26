# ADR 0005: Contract Versioning

## Status
Accepted

## Context
Frontend and backend must work in parallel with minimal drift.

## Decision
- Freeze OpenAPI as v0.1 baseline.
- Publish changelog with semantic contract updates.
- Require examples for each endpoint success/error payload.

## Consequences
- Predictable frontend integration.
- Discipline required for backward compatibility management.
