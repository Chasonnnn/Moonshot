from datetime import datetime, timedelta, timezone

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.entities import JobRunModel
from app.services.jobs import process_jobs_once


def _drain_jobs(limit=20):
    processed = 0
    for _ in range(limit):
        if not process_jobs_once():
            break
        processed += 1
    return processed


def test_generate_is_async_submit_and_result(client, admin_headers):
    case = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "Async Generation",
            "scenario": "Investigate anomaly.",
            "artifacts": [],
            "metrics": [],
            "allowed_tools": ["sql_workspace"],
        },
    )
    assert case.status_code == 201
    case_id = case.json()["id"]

    submit = client.post(
        f"/v1/cases/{case_id}/generate",
        headers={**admin_headers, "Idempotency-Key": "gen-key-1"},
    )
    assert submit.status_code == 202
    job_id = submit.json()["job_id"]

    status_pending = client.get(f"/v1/jobs/{job_id}", headers=admin_headers)
    assert status_pending.status_code == 200
    assert status_pending.json()["status"] in {"pending", "running"}

    assert _drain_jobs() >= 1

    status_done = client.get(f"/v1/jobs/{job_id}", headers=admin_headers)
    assert status_done.status_code == 200
    assert status_done.json()["status"] == "completed"

    result = client.get(f"/v1/jobs/{job_id}/result", headers=admin_headers)
    assert result.status_code == 200
    payload = result.json()["result"]
    assert payload["task_family"]["id"]
    assert len(payload["task_family"]["variants"]) >= 3


def test_score_is_async_and_creates_export(client, admin_headers, reviewer_headers, candidate_headers):
    case = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "Async Score",
            "scenario": "Investigate conversion drop",
            "artifacts": [],
            "metrics": [],
            "allowed_tools": ["sql_workspace", "copilot"],
        },
    )
    case_id = case.json()["id"]

    gen_submit = client.post(
        f"/v1/cases/{case_id}/generate",
        headers={**admin_headers, "Idempotency-Key": "gen-key-2"},
    )
    gen_job_id = gen_submit.json()["job_id"]
    _drain_jobs()
    gen_result = client.get(f"/v1/jobs/{gen_job_id}/result", headers=admin_headers).json()["result"]
    task_family_id = gen_result["task_family"]["id"]

    review = client.post(
        f"/v1/task-families/{task_family_id}/review",
        headers=reviewer_headers,
        json={"decision": "approve", "review_note": "ready"},
    )
    assert review.status_code == 200
    publish = client.post(f"/v1/task-families/{task_family_id}/publish", headers=reviewer_headers, json={})
    assert publish.status_code == 200

    session = client.post(
        "/v1/sessions",
        headers=reviewer_headers,
        json={"task_family_id": task_family_id, "candidate_id": "candidate_1", "policy": {"raw_content_opt_in": False}},
    )
    session_id = session.json()["id"]

    ingest = client.post(
        f"/v1/sessions/{session_id}/events",
        headers=candidate_headers,
        json={"events": [{"event_type": "sql_query_run", "payload": {"time_to_first_action_ms": 1200}}]},
    )
    assert ingest.status_code == 202

    submit = client.post(f"/v1/sessions/{session_id}/submit", headers=candidate_headers, json={"final_response": "summary"})
    assert submit.status_code == 200

    score_submit = client.post(
        f"/v1/sessions/{session_id}/score",
        headers={**reviewer_headers, "Idempotency-Key": "score-key-1"},
    )
    assert score_submit.status_code == 202
    score_job_id = score_submit.json()["job_id"]

    _drain_jobs()

    score_result = client.get(f"/v1/jobs/{score_job_id}/result", headers=reviewer_headers)
    assert score_result.status_code == 200
    score_payload = score_result.json()["result"]
    assert score_payload["session_id"] == session_id
    assert "trigger_codes" in score_payload

    audit = client.get("/v1/audit-logs", headers=admin_headers)
    assert audit.status_code == 200
    export_run_id = None
    for item in audit.json()["items"]:
        if item["action"] == "score":
            export_run_id = item["metadata"].get("export_run_id")
    assert export_run_id is not None

    export = client.get(f"/v1/exports/{export_run_id}", headers=reviewer_headers)
    assert export.status_code == 200


def test_redteam_is_async_submit(client, admin_headers):
    response = client.post(
        "/v1/redteam/runs",
        headers={**admin_headers, "Idempotency-Key": "redteam-1"},
        json={"target_type": "task_family", "target_id": "00000000-0000-0000-0000-000000000001"},
    )
    assert response.status_code == 202
    job_id = response.json()["job_id"]

    _drain_jobs()

    result = client.get(f"/v1/jobs/{job_id}/result", headers=admin_headers)
    assert result.status_code == 200
    assert result.json()["result"]["status"] == "completed"


def test_async_endpoints_require_idempotency_key(client, admin_headers):
    case = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "Missing Idempotency",
            "scenario": "Scenario",
            "artifacts": [],
            "metrics": [],
            "allowed_tools": [],
        },
    )
    case_id = case.json()["id"]

    no_key = client.post(f"/v1/cases/{case_id}/generate", headers=admin_headers)
    assert no_key.status_code == 400


def test_job_result_pending_returns_explicit_status(client, admin_headers):
    case = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "Pending Result Status",
            "scenario": "Scenario",
            "artifacts": [],
            "metrics": [],
            "allowed_tools": [],
        },
    )
    case_id = case.json()["id"]

    submit = client.post(
        f"/v1/cases/{case_id}/generate",
        headers={**admin_headers, "Idempotency-Key": "pending-result-1"},
    )
    job_id = submit.json()["job_id"]

    pending_result = client.get(f"/v1/jobs/{job_id}/result", headers=admin_headers)
    assert pending_result.status_code == 200
    payload = pending_result.json()
    assert payload["status"] in {"pending", "running", "retrying"}
    assert payload["result"] == {}


def test_job_retry_backoff_and_dead_letter(client, admin_headers, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "worker_max_attempts_default", 2)
    monkeypatch.setattr(settings, "worker_retry_base_seconds", 120.0)

    case = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "Retry Backoff",
            "scenario": "Scenario",
            "artifacts": [],
            "metrics": [],
            "allowed_tools": [],
        },
    )
    case_id = case.json()["id"]

    def _boom(_case):
        raise RuntimeError("forced_generation_failure")

    monkeypatch.setattr("app.services.jobs.generate_from_case", _boom)
    submit = client.post(
        f"/v1/cases/{case_id}/generate",
        headers={**admin_headers, "Idempotency-Key": "retry-case-1"},
    )
    job_id = submit.json()["job_id"]

    assert process_jobs_once() is True

    retry_status = client.get(f"/v1/jobs/{job_id}", headers=admin_headers)
    assert retry_status.status_code == 200
    retry_payload = retry_status.json()
    assert retry_payload["status"] == "retrying"
    assert retry_payload["next_attempt_at"] is not None

    # Backoff should prevent immediate re-run.
    assert process_jobs_once() is False

    with SessionLocal() as db:
        row = db.get(JobRunModel, job_id)
        assert row is not None
        row.next_attempt_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()

    assert process_jobs_once() is True

    failed_status = client.get(f"/v1/jobs/{job_id}", headers=admin_headers)
    assert failed_status.status_code == 200
    assert failed_status.json()["status"] == "failed_permanent"

    failed_result = client.get(f"/v1/jobs/{job_id}/result", headers=admin_headers)
    assert failed_result.status_code == 200
    failed_payload = failed_result.json()
    assert failed_payload["status"] == "failed_permanent"
    assert failed_payload["result"]["error_code"] == "runtimeerror"
