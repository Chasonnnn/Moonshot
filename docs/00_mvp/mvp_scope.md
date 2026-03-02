# Moonshot MVP Scope (Backend-First, v0.6.0)

## Objective
Ship an evidence-loop MVP where task generation, coaching, and scoring are grounded in real business context and continuously improved with auditable feedback loops.

## Primary Outcome
A pilot-ready JDA assessment platform where an admin can:
1. Define business context and employer-grounded case inputs.
2. Generate and review task families and rubrics.
3. Evaluate task quality signals before publishing.
4. Run sessions in explicit coaching modes (`practice` / `assessment` / `assessment_no_ai` / `assessment_ai_assisted`).
5. Produce stable, versioned scores plus richer interpretation views.
6. Run fairness smoke checks and trace context injection/audit lineage.

## In Scope
- API-first contracts and docs as system of record (`v0.6.0`).
- Co-design content loop with quality evaluation (`TaskQualitySignal`).
- Coaching mode separation and coaching feedback capture.
- Stable scoring engine + interpretation view engine split.
- Context injection traces for coach/evaluator paths.
- Fairness smoke run APIs and governance telemetry.
- Red-team, exports, audit chain verification, and SLO probes.

## Out of Scope
- End-to-end RL policy optimization.
- Production ATS/LMS integrations.
- Frontend implementation details and visual design.

## Non-Functional Targets
- Pilot envelope: up to 50 candidates/week.
- Tenant isolation + auditable provenance by default.
- Derived telemetry default; raw content opt-in + TTL purge.
- No fallback routes; explicit failure responses only.

## Delivery Gates
1. OpenAPI and event schema frozen at `v0.6.0`.
2. Scoring-version lock present in interpretation views.
3. Coaching mode policy tests and anti-leakage tests green.
4. Task quality + fairness smoke APIs available and tested.
5. Contract governance and OpenAPI sync checks green.
