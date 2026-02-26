# Frontend/Backend Contract v0.1

## Integration Principles
- Frontend builds against OpenAPI v0.1 and fixture examples.
- Backward compatibility is not guaranteed during active development.
- Every endpoint includes success + error examples.
- API responses are tenant-scoped; cross-tenant resources return `404`.
- CORS is enabled for local frontend development origins (`http://localhost:3000`, `http://localhost:3001`).

## Role Matrix
- `org_admin`: full authoring, publish, red-team, export, audit access.
- `reviewer`: review, score visibility, report access.
- `candidate`: session runtime, event submission, coach messaging.

## Required Mocking Assets
- Fixture payloads for all endpoints.
- Seeded JDA scenarios and example session outputs.

## Handoff Artifacts
- OpenAPI spec: `docs/03_api/openapi.yaml`
- Examples: `apps/api/fixtures/*.json`
- Event schema: `docs/04_events/event_schema.md`

## Frontend Bootstrap Endpoints
- `GET /v1/business-context/packs`
- `GET /v1/business-context/packs/{pack_id}`
- `GET /v1/cases`
- `GET /v1/cases/{case_id}`
- `GET /v1/task-families`
- `GET /v1/task-families/{task_family_id}`
- `GET /v1/sessions`
- `GET /v1/sessions/{session_id}`

## Versioning
- Semantic version tags for API contract.
- Changelog entry required for each contract modification, including breaking changes.
