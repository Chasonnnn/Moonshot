# Moonshot MVP Scope (Backend-First)

## Objective
Ship a backend-first MVP that allows frontend development to proceed in parallel while preserving enterprise-grade controls.

## Primary Outcome
A pilot-ready JDA assessment system where an admin can define business context, generate task families and rubrics, run sessions, score results, and export reports with auditability.

## In Scope
- API-first contracts and documentation as system of record.
- FastAPI backend skeleton with role-aware endpoints.
- Co-design pipeline primitives for case/task/rubric generation.
- Session runtime APIs with telemetry ingestion.
- Context-only coach policy enforcement endpoint.
- Hybrid scoring endpoint with review triggers.
- Reporting, export, red-team, and audit-log endpoints.
- Baseline Postgres schema and migrations.

## Out of Scope
- Frontend implementation and visual design.
- Production ATS integration.
- Fully managed model-provider integrations (stubbed policy-compatible interfaces only).

## Non-Functional Targets
- Pilot envelope: up to 50 candidates/week.
- Stable API versioning with explicit changelog and breaking-change visibility.
- Tenant isolation model and audit history at API boundary.
- Derived telemetry default; raw content retention opt-in.

## Delivery Gates
1. OpenAPI v0.2 frozen and published.
2. Event schema v0.2 frozen.
3. Core endpoint tests green (contract + RBAC + coach safety).
4. Seed fixtures available for frontend integration.
