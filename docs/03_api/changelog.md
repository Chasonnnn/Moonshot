# API Changelog

## 0.1.1 - 2026-02-26
- Added tenant-scoped read endpoints for frontend bootstrap:
  - `GET /v1/business-context/packs`
  - `GET /v1/business-context/packs/{pack_id}`
  - `GET /v1/cases`
  - `GET /v1/cases/{case_id}`
  - `GET /v1/task-families`
  - `GET /v1/task-families/{task_family_id}`
  - `GET /v1/sessions`
  - `GET /v1/sessions/{session_id}`
- Added strict tenant isolation checks to read/write flows.
- Namespaced idempotency cache by tenant for generate/score/red-team endpoints.
- Enabled CORS for local frontend origins (`http://localhost:3000`, `http://localhost:3001`).

## 0.1.0 - 2026-02-26
- Initial endpoint set for backend-first MVP.
- Added business context, case, generation, session, coach, scoring, reporting, export, red-team, and audit endpoints.
- Added RBAC role policy baseline (`org_admin`, `reviewer`, `candidate`).
