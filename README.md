# Moonshot

Backend-first MVP scaffold for Moonshot's evidence-based work simulation platform.

## Architecture

Moonshot is an API-first work simulation platform with explicit evidence loops:
- API service: FastAPI (`apps/api/app`)
- Database: PostgreSQL 18 (`docker-compose.yml`)
- Async worker: Postgres-backed job runner (`apps/api/app/workers/main.py`)
- Frontend: Next.js app consuming contract-first APIs (`apps/app`)

Core runtime flow:
1. Admin creates case context and submits async generation.
2. Worker produces task family + rubric + diagnostics.
3. Reviewer/admin approves and publishes.
4. Candidate runs session (events, coach, submit).
5. Reviewer/admin submits async scoring.
6. Reports, interpretations, exports, fairness/red-team, and audit artifacts are retrieved via APIs.

Positioning focus:
- Work simulations for analyst, strategy, and support hiring.
- Evidence about how candidates work, not just what they submit.
- Reviewable governance surfaces for fairness, provenance, and auditability.

## Data Model

Primary entities (high level):
- `BusinessContextPack`: employer context and constraints.
- `CaseSpec`: scenario, artifacts, metrics, allowed tools.
- `TaskFamily`: variants + generation diagnostics + review/publish states.
- `Rubric`: dimensions, anchors, failure modes.
- `Session`: runtime candidate attempt with policy and mode.
- `EventLog`: process evidence and telemetry events.
- `ScoreResult`: scores, objective metrics, trigger codes/impacts, provenance.
- `ReportSummary/Report`: evaluation outputs for frontend/admin.
- `TaskQualitySignal`: diversity/realism/leakage/grounding quality metrics.
- `JobRun/JobAttempt`: async lifecycle with retries/leases/dead-letter states.
- `RedTeamRun`, `FairnessSmokeRun`, `AuditLog`: governance and safety controls.

Authoritative references:
- [Domain model](docs/02_domain/domain_model.md)
- [OpenAPI contract](docs/03_api/openapi.yaml)
- [Event schema](docs/04_events/event_schema.md)
- [Security/privacy controls](docs/06_security/privacy_and_controls.md)

## Commands

```bash
cd /Users/chason/Moonshot
uv sync --extra dev
```

Local environment bootstrap:

```bash
cp apps/api/.env.example apps/api/.env.local
export MOONSHOT_DATABASE_URL=postgresql+psycopg://moonshot:moonshot@localhost:5432/moonshot
export MOONSHOT_BOOTSTRAP_TOKEN=moonshot-bootstrap-dev
export MOONSHOT_JWT_SIGNING_KEYS='{"v1":"moonshot-dev-signing-key-change-me"}'
export MOONSHOT_MODEL_PROVIDER=litellm
export MOONSHOT_LITELLM_BASE_URL=https://<your-litellm-host>
export MOONSHOT_LITELLM_API_KEY=<your-litellm-api-key>
```

Hybrid local runtime (recommended):

```bash
make db-up
make migrate
make api-run
make worker-run
```

One-command local stack:

```bash
make dev-stack
```

Testing and checks:

```bash
cd /Users/chason/Moonshot
uv run --extra dev pytest
uv run python apps/api/scripts/check_contract_governance.py
uv run python apps/api/scripts/check_openapi_sync.py
uv run python apps/api/scripts/check_frontend_contract_sync.py
uv run python apps/api/scripts/check_api_examples.py
uv run python apps/api/scripts/check_report_summary_consistency.py
uv run python apps/api/scripts/check_export_schema.py
uv run python apps/api/scripts/check_score_drift.py
```

Frontend local run:

```bash
cd /Users/chason/Moonshot/apps/app
cp .env.example .env.local
pnpm install
pnpm dev
```

Integration page: `http://localhost:3000/pilots`
Guided demo page: `http://localhost:3000/demo`
Employer ops pages:
- `http://localhost:3000/cases`
- `http://localhost:3000/review-queue`
- `http://localhost:3000/reports/<session-id>`
- `http://localhost:3000/governance`

Frontend smoke against backend:

```bash
make frontend-smoke
make demo-gate
```

Scenario packaging + governance bundle:

```bash
uv run python apps/api/scripts/seed_demo.py --mode both --tenant-id tenant_demo --output /tmp/moonshot_seed_manifest.json
uv run python apps/api/scripts/build_governance_bundle.py --tenant-id tenant_demo --session-id <session-id>
```

## API Lifecycle

Canonical JDA async lifecycle:
1. `POST /v1/auth/token` (bootstrap JWT for local/staging)
2. `POST /v1/cases`
3. `POST /v1/cases/{case_id}/generate` (`Idempotency-Key` required)
4. Poll `GET /v1/jobs/{job_id}` and `GET /v1/jobs/{job_id}/result`
5. `POST /v1/task-families/{task_family_id}/review`
6. `POST /v1/task-families/{task_family_id}/publish`
7. `POST /v1/sessions`
8. `POST /v1/sessions/{session_id}/events`
9. `POST /v1/sessions/{session_id}/coach/message`
10. `POST /v1/sessions/{session_id}/submit`
11. `POST /v1/sessions/{session_id}/score` (`Idempotency-Key` required)
12. `GET /v1/reports/{session_id}/summary` and `GET /v1/reports/{session_id}`
13. `POST /v1/exports` (`Idempotency-Key` required), then poll job result
14. `GET /v1/redteam/runs` and `GET /v1/fairness/smoke-runs` for evidence review loops

Async diagnostics contract:
- Job status exposes `progress`, `current_step`, `attempt_count`, `max_attempts`, `last_error_code`.
- Not-ready result returns `result.error_code=job_not_ready`.
- Failed result returns `result.error_code`, `result.error_detail`, `result.failed_step`.

## Roadmap

Current contract baseline:
- `v0.5.1` (OpenAPI/docs/frontend contract sync)

MVP near-term focus:
1. Pilot reliability hardening (SLO/load envelope, worker/runtime stability).
2. Governance evidence depth (audit integrity checks, retention/TTL workflows, fairness/red-team provenance).
3. Scoring/evidence quality improvements (diagnostic richness, benchmark drift controls).
4. Demo script hardening and regression scenario packaging.

Tracking docs:
- [MVP scope](docs/00_mvp/mvp_scope.md)
- [API changelog](docs/03_api/changelog.md)
- [Ops runbook](docs/07_ops/runbook.md)
- [Frontend contract](docs/08_frontend_contract/frontend_backend_contract.md)
- [DoorDash 4-week enablement](docs/09_candidate_enablement/doordash_4week_candidate_enablement.md)

## Troubleshooting

Common issues and fixes:
- `missing_idempotency_key`:
  - Add `Idempotency-Key` header on async submit endpoints.
- `job_not_ready`:
  - Continue polling `GET /v1/jobs/{job_id}` and `GET /v1/jobs/{job_id}/result`.
- `runtime-env: FAIL (...)` on startup:
  - Set required env vars shown in `apps/api/.env.example`.
- `provider_litellm_base_url_missing` / `provider_litellm_api_key_missing`:
  - Set `MOONSHOT_LITELLM_BASE_URL` and `MOONSHOT_LITELLM_API_KEY`.
- `provider_litellm_required_models_missing`:
  - Ensure your LiteLLM `/v1/model/info` includes:
    - `gpt-5.3-codex`
    - `chatgpt/gpt-5.2`
    - `gemini/gemini-3.1-pro-preview`
    - `gemini/gemini-3.1-flash-lite-preview`
    - `anthropic/claude-opus-4-6`
- Migration guard rejects SQLite:
  - Migrations are Postgres-authoritative. Use `MOONSHOT_DATABASE_URL=postgresql+psycopg://...`.
- Worker appears idle:
  - Check `GET /v1/workers/health` and `GET /v1/jobs/stale-leases`.
- Contract drift in CI:
  - Run `uv run python apps/api/scripts/dump_openapi.py` and re-run contract checks.
