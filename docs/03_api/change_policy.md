# API Change Policy (Pre-Release)

## Current Mode
This repository is in active pre-release development. Backward compatibility is not required.

## Rules
1. Breaking changes are allowed if they improve architecture, speed, or correctness.
2. Every contract change must be documented in `docs/03_api/changelog.md`.
3. Frontend teams must consume the latest contract snapshot and fixtures.
4. Deprecated fields should be removed quickly instead of preserved long-term.

## Coordination
- Update `docs/03_api/openapi.yaml` and `apps/api/fixtures/api_examples.json` in the same change.
- Announce changed/removed endpoints and payload fields in the changelog entry.
