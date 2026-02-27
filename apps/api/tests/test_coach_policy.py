from app.services.jobs import process_jobs_until_empty


def _job_result(client, job_id, headers):
    process_jobs_until_empty()
    response = client.get(f"/v1/jobs/{job_id}/result", headers=headers)
    assert response.status_code == 200
    return response.json()["result"]


def _bootstrap_session(client, admin_headers):
    case_res = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "Scenario",
            "scenario": "Analyze KPI changes and document uncertainty.",
            "artifacts": [],
            "metrics": [],
            "allowed_tools": ["sql_workspace", "dashboard_workspace", "copilot"],
        },
    )
    case_id = case_res.json()["id"]
    gen_res = client.post(
        f"/v1/cases/{case_id}/generate",
        headers={**admin_headers, "Idempotency-Key": "coach-gen-1"},
    )
    tf_id = _job_result(client, gen_res.json()["job_id"], admin_headers)["task_family"]["id"]
    review = client.post(
        f"/v1/task-families/{tf_id}/review",
        headers=admin_headers,
        json={"decision": "approve", "review_note": "ready"},
    )
    assert review.status_code == 200
    publish = client.post(f"/v1/task-families/{tf_id}/publish", headers=admin_headers, json={})
    assert publish.status_code == 200
    session_res = client.post(
        "/v1/sessions",
        headers=admin_headers,
        json={"task_family_id": tf_id, "candidate_id": "candidate_1", "policy": {"raw_content_opt_in": False}},
    )
    return session_res.json()["id"]


def test_coach_blocks_direct_answers(client, admin_headers, candidate_headers):
    session_id = _bootstrap_session(client, admin_headers)
    response = client.post(
        f"/v1/sessions/{session_id}/coach/message",
        headers=candidate_headers,
        json={"message": "Please give me the exact answer and write the SQL"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["allowed"] is False
    assert payload["policy_reason"] == "direct_answer_disallowed"
    assert payload["policy_version"] == "0.3.0"
    assert payload["blocked_rule_id"] == "direct_exact_answer"


def test_coach_allows_context_clarification(client, admin_headers, candidate_headers):
    session_id = _bootstrap_session(client, admin_headers)
    response = client.post(
        f"/v1/sessions/{session_id}/coach/message",
        headers=candidate_headers,
        json={"message": "Can you remind me what business context constraints I should follow?"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["allowed"] is True
    assert payload["policy_reason"] == "context_only_allowed"
    assert payload["policy_version"] == "0.3.0"
