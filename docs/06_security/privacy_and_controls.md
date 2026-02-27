# Security, Privacy, And Governance Controls (MVP)

## Security Baseline
- RBAC enforcement at endpoint level.
- Tenant-scoped resource checks.
- Immutable audit logging for privileged actions.
- Idempotency keys for mutation endpoints.

## Privacy Defaults
- Derived telemetry storage by default.
- Raw response retention only with explicit session policy.
- Retention TTL field captured for purge workflows.

## Governance Controls
- Scoring config changes tracked in audit logs.
- Versioned policy artifacts for coach/evaluator behavior.
- Red-team findings linked to mitigation status.
- Audit logs are chained with `prev_hash` and `entry_hash` for tamper-evidence verification.
- Admin verification endpoint is available for chain validation: `GET /v1/audit-logs/verify`.

## SOC2-Ready Practices in MVP
- Access control mapping by role.
- Change management through migration/version artifacts.
- Observability and incident runbook references.
