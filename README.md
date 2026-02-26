# Moonshot

Backend-first MVP scaffold for API contracts, documentation, and integration-safe domain endpoints.

## Quick start

```bash
cd /Users/chason/Moonshot
uv sync --extra dev
uv run uvicorn app.main:app --app-dir apps/api --reload
```

## Docs
- API contract: `docs/03_api/openapi.yaml`
- Domain model: `docs/02_domain/domain_model.md`
- Event schema: `docs/04_events/event_schema.md`

## Tests

```bash
uv run --extra dev pytest
```
