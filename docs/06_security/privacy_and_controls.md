# Security, Privacy, And Governance Controls (MVP v0.3)

## Security Baseline
- JWT RBAC enforcement at endpoint boundaries.
- Tenant-scoped resource checks.
- Immutable audit logging with hash-chain verification.
- Idempotency keys for async mutation endpoints.
- No fallback routes; explicit error responses.
- Managed-secrets startup validation supports fail-closed behavior when required.

## Privacy Defaults
- Derived telemetry storage by default.
- Raw response retention only with explicit session policy opt-in.
- Retention TTL captured and purge-capable.

## Governance Controls
- Versioned coach/evaluator policy artifacts.
- Scoring provenance in every report and interpretation view.
- Context injection trace capture for coach/evaluator paths.
- Fairness smoke run artifacts are stored and auditable.
- Red-team findings linked to mitigation outcomes.

## Typed Memory / Context Rules
- Institutional context: org policies, glossary, role profiles.
- Content context: task families, rubrics, failure cases.
- Interaction context: aggregated confusion/helpfulness signals.

Write policy:
- mark entries as `admin_approved` or `model_inferred`
- enforce tenant isolation and role-based visibility
- redact or derive where possible

## SOC2-Ready Practices in MVP
- Access-control matrix by role and endpoint.
- Change management via docs/changelog/version gates.
- Operational runbook with contract and drift checks.
