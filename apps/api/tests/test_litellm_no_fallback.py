from app.core.config import get_settings
from app.services.jobs import process_jobs_until_empty


def _job_result(client, job_id, headers):
    process_jobs_until_empty()
    response = client.get(f"/v1/jobs/{job_id}/result", headers=headers)
    assert response.status_code == 200
    return response.json()["result"]


def _bootstrap_submitted_session(client, admin_headers, reviewer_headers, candidate_headers) -> str:
    case_response = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "No Fallback Session",
            "scenario": "Investigate retention drop.",
            "artifacts": [],
            "metrics": [],
            "allowed_tools": ["sql_workspace"],
        },
    )
    assert case_response.status_code == 201
    case_id = case_response.json()["id"]

    generate_response = client.post(
        f"/v1/cases/{case_id}/generate",
        headers={**admin_headers, "Idempotency-Key": "no-fallback-gen-1"},
    )
    assert generate_response.status_code == 202
    generate_payload = _job_result(client, generate_response.json()["job_id"], admin_headers)
    task_family_id = generate_payload["task_family"]["id"]

    review = client.post(
        f"/v1/task-families/{task_family_id}/review",
        headers=reviewer_headers,
        json={"decision": "approve"},
    )
    assert review.status_code == 200
    publish = client.post(
        f"/v1/task-families/{task_family_id}/publish",
        headers=reviewer_headers,
        json={},
    )
    assert publish.status_code == 200

    session = client.post(
        "/v1/sessions",
        headers=reviewer_headers,
        json={
            "task_family_id": task_family_id,
            "candidate_id": "candidate_1",
            "policy": {"raw_content_opt_in": False},
        },
    )
    assert session.status_code == 201
    session_id = session.json()["id"]

    ingest = client.post(
        f"/v1/sessions/{session_id}/events",
        headers=candidate_headers,
        json={"events": [{"event_type": "sql_query_run", "payload": {}}]},
    )
    assert ingest.status_code == 202
    submit = client.post(
        f"/v1/sessions/{session_id}/submit",
        headers=candidate_headers,
        json={"final_response": "I validated the retention segments."},
    )
    assert submit.status_code == 200
    return session_id


def test_scoring_provider_failure_surfaces_without_fallback(client, admin_headers, reviewer_headers, candidate_headers, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "worker_max_attempts_default", 1)

    session_id = _bootstrap_submitted_session(client, admin_headers, reviewer_headers, candidate_headers)

    def _raise_provider_error(**_kwargs):
        raise RuntimeError("provider_litellm_unavailable")

    monkeypatch.setattr("app.services.jobs.get_evaluator_provider", _raise_provider_error)

    score_submit = client.post(
        f"/v1/sessions/{session_id}/score",
        headers={**reviewer_headers, "Idempotency-Key": "no-fallback-score-1"},
        json={"mode": "live"},
    )
    assert score_submit.status_code == 202
    job_id = score_submit.json()["job_id"]

    process_jobs_until_empty()

    status_payload = client.get(f"/v1/jobs/{job_id}", headers=reviewer_headers).json()
    assert status_payload["status"] == "failed_permanent"
    assert status_payload["last_error_code"] == "provider_error"

    result_payload = client.get(f"/v1/jobs/{job_id}/result", headers=reviewer_headers).json()["result"]
    assert result_payload["error_code"] == "provider_error"
