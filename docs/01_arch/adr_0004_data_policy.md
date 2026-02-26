# ADR 0004: Data Policy Defaults

## Status
Accepted

## Context
Pilot partners require privacy-safe defaults.

## Decision
Store derived telemetry by default. Raw candidate content is retained only when explicitly enabled via session policy and subject to TTL.

## Consequences
- Reduced privacy risk.
- Additional complexity for QA and dispute review; handled by opt-in retention mode.
