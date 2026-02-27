# Moonshot

Backend-first MVP scaffold for API contracts, documentation, and integration-safe domain endpoints.

## Quick start

```bash
cd /Users/chason/Moonshot
uv sync --extra dev
cp .env.example .env
docker compose up -d postgres
export MOONSHOT_DATABASE_URL=postgresql+psycopg://moonshot:moonshot@localhost:5432/moonshot
apps/api/scripts/start_api.sh
```

## Local test run

```bash
cd /Users/chason/Moonshot
uv run --extra dev pytest
```

## Frontend local run

```bash
cd /Users/chason/Moonshot/apps/app
cp .env.example .env.local
pnpm install
pnpm dev
```

Integration page: `http://localhost:3000/pilots`

## Docs
- API contract: `docs/03_api/openapi.yaml`
- Domain model: `docs/02_domain/domain_model.md`
- Event schema: `docs/04_events/event_schema.md`
