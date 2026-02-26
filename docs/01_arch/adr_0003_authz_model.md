# ADR 0003: AuthN/AuthZ Baseline

## Status
Accepted

## Context
Frontend and backend teams need deterministic role behavior now.

## Decision
Implement role-based access control skeleton using request headers in MVP dev:
- `org_admin`
- `reviewer`
- `candidate`

## Consequences
- Frontend can integrate immediately with stable role behavior.
- Real identity providers can replace header-based auth via dependency swap.
