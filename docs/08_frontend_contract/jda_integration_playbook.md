# JDA Frontend Integration Playbook (v0.4.0)

## Purpose
This playbook is the implementation contract for frontend teams integrating the JDA MVP path with backend `v0.4.0`.

## Required Runtime Headers
1. `Authorization: Bearer <jwt>`
2. `X-Request-Id: <uuid>` (recommended for traceability)
3. `Idempotency-Key: <stable-key>` on async submit endpoints only

## Token Bootstrap (Local and Staging)
1. Request token:
   - `POST /v1/auth/token`
   - Header: `X-Bootstrap-Token`
2. Claims required in request body:
   - `tenant_id`
   - `role`
   - `user_id`
   - optional `expires_in_seconds`
3. Never use header-only impersonation; runtime endpoints require bearer JWT.

## Canonical JDA Flow
1. Create case: `POST /v1/cases`
2. Submit generation job: `POST /v1/cases/{case_id}/generate` with `Idempotency-Key`
3. Poll job:
   - `GET /v1/jobs/{job_id}`
   - `GET /v1/jobs/{job_id}/result`
4. Review and publish:
   - `POST /v1/task-families/{task_family_id}/review`
   - `POST /v1/task-families/{task_family_id}/publish`
5. Create session: `POST /v1/sessions`
6. Set coach mode: `POST /v1/sessions/{session_id}/mode`
7. Candidate runtime:
   - `POST /v1/sessions/{session_id}/events`
   - `POST /v1/sessions/{session_id}/coach/message`
   - `POST /v1/sessions/{session_id}/submit`
8. Submit scoring job: `POST /v1/sessions/{session_id}/score` with `Idempotency-Key`
9. Read outputs:
   - `GET /v1/reports/{session_id}/summary`
   - `GET /v1/reports/{session_id}`
10. Submit export job: `POST /v1/exports` with `Idempotency-Key`
11. Poll and fetch export:
   - `GET /v1/jobs/{job_id}/result`
   - `GET /v1/exports/{run_id}`

## Polling Cadence and Timeouts
1. Poll interval:
   - Start at 750ms.
   - Exponential backoff up to 3000ms max interval.
2. Per-job timeout:
   - Default 90 seconds.
   - Surface timeout as explicit UI error.
3. Status handling:
   - `pending|running|retrying`: continue polling
   - `completed`: consume result
   - `failed_permanent`: stop, show `error_code` and `error_detail`
4. Not-ready result semantics:
   - `GET /v1/jobs/{job_id}/result` may return `result.error_code=job_not_ready`.

## Error Handling Contract
All non-2xx API responses return:
1. `detail`
2. `error_code`
3. `error_detail`
4. `request_id`

Frontend must log and display `request_id` in developer/debug views.

## Idempotency Rules
1. Required for:
   - generate
   - score
   - export
   - redteam
   - quality evaluate
   - interpretation generate
   - fairness smoke run
2. Use stable keys for retries of the same logical action.
3. Never reuse keys across different action types.

## Local Configuration
Server-only frontend env vars:
1. `MOONSHOT_API_BASE_URL`
2. `MOONSHOT_BOOTSTRAP_TOKEN`
3. `MOONSHOT_DEV_TENANT_ID`
4. `MOONSHOT_DEV_ADMIN_USER_ID`
5. `MOONSHOT_DEV_REVIEWER_USER_ID`
6. `MOONSHOT_DEV_CANDIDATE_USER_ID`
