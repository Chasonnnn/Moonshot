# Frontend/Backend Contract v0.1

## Integration Principles
- Frontend builds against OpenAPI v0.1 and fixture examples.
- Backward compatibility is not guaranteed during active development.
- Every endpoint includes success + error examples.

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

## Versioning
- Semantic version tags for API contract.
- Changelog entry required for each contract modification, including breaking changes.
