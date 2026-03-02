from app.core.security import issue_access_token
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
            "title": "Session Mode + Events Case",
            "scenario": "Investigate KPI change and justify escalation.",
            "artifacts": [],
            "metrics": [],
            "allowed_tools": ["sql_workspace", "dashboard_workspace", "copilot"],
        },
    )
    assert case_res.status_code == 201
    case_id = case_res.json()["id"]

    generate = client.post(
        f"/v1/cases/{case_id}/generate",
        headers={**admin_headers, "Idempotency-Key": "session-mode-events-gen-1"},
    )
    assert generate.status_code == 202
    generated = _job_result(client, generate.json()["job_id"], admin_headers)
    task_family_id = generated["task_family"]["id"]

    review = client.post(
        f"/v1/task-families/{task_family_id}/review",
        headers=admin_headers,
        json={"decision": "approve", "review_note": "ready"},
    )
    assert review.status_code == 200
    publish = client.post(
        f"/v1/task-families/{task_family_id}/publish",
        headers=admin_headers,
        json={},
    )
    assert publish.status_code == 200

    session_res = client.post(
        "/v1/sessions",
        headers=admin_headers,
        json={"task_family_id": task_family_id, "candidate_id": "candidate_1", "policy": {"raw_content_opt_in": False}},
    )
    assert session_res.status_code == 201
    return session_res.json()["id"]


def test_session_mode_accepts_all_four_modes(client, admin_headers):
    session_id = _bootstrap_session(client, admin_headers)
    modes = [
        "practice",
        "assessment",
        "assessment_no_ai",
        "assessment_ai_assisted",
    ]

    for mode in modes:
        response = client.post(
            f"/v1/sessions/{session_id}/mode",
            headers=admin_headers,
            json={"mode": mode},
        )
        assert response.status_code == 200
        assert response.json()["policy"]["coach_mode"] == mode

    invalid = client.post(
        f"/v1/sessions/{session_id}/mode",
        headers=admin_headers,
        json={"mode": "invalid_mode"},
    )
    assert invalid.status_code == 422
    payload = invalid.json()
    assert payload["error_code"] == "validation_error"


def test_assessment_no_ai_blocks_coach_message_with_explicit_error(client, admin_headers, candidate_headers):
    session_id = _bootstrap_session(client, admin_headers)
    mode = client.post(
        f"/v1/sessions/{session_id}/mode",
        headers=admin_headers,
        json={"mode": "assessment_no_ai"},
    )
    assert mode.status_code == 200

    blocked = client.post(
        f"/v1/sessions/{session_id}/coach/message",
        headers=candidate_headers,
        json={"message": "Can you write the answer for me?"},
    )
    assert blocked.status_code == 403
    blocked_payload = blocked.json()
    assert blocked_payload["error_code"] == "coach_disabled_for_mode"
    assert blocked_payload["error_detail"] == "coach is disabled in assessment_no_ai mode"
    assert isinstance(blocked_payload["request_id"], str) and blocked_payload["request_id"]

    events = client.get(f"/v1/sessions/{session_id}/events", headers=admin_headers)
    assert events.status_code == 200
    items = events.json()["items"]
    assert any(
        item["event_type"] == "coach_message"
        and item["payload"].get("policy_decision_code") == "blocked_mode_disabled"
        for item in items
    )

    logs = client.get("/v1/audit-logs?action=coach_message", headers=admin_headers)
    assert logs.status_code == 200
    entries = [item for item in logs.json()["items"] if item["resource_id"] == session_id]
    assert entries
    assert entries[-1]["metadata"]["policy_decision_code"] == "blocked_mode_disabled"
    assert entries[-1]["metadata"]["coach_mode"] == "assessment_no_ai"


def test_list_session_events_supports_pagination_and_filtering(client, admin_headers, candidate_headers):
    session_id = _bootstrap_session(client, admin_headers)

    ingest = client.post(
        f"/v1/sessions/{session_id}/events",
        headers=candidate_headers,
        json={
            "events": [
                {"event_type": "session_started", "payload": {"step": 1}},
                {"event_type": "sql_query_run", "payload": {"row_count": 3}},
                {"event_type": "tab_blur_detected", "payload": {"duration_ms": 1200}},
            ]
        },
    )
    assert ingest.status_code == 202

    first_page = client.get(
        f"/v1/sessions/{session_id}/events?limit=2",
        headers=admin_headers,
    )
    assert first_page.status_code == 200
    first_payload = first_page.json()
    assert len(first_payload["items"]) == 2
    assert first_payload["next_cursor"] == 2
    assert first_payload["limit"] == 2
    assert first_payload["total"] == 3

    second_page = client.get(
        f"/v1/sessions/{session_id}/events?limit=2&cursor={first_payload['next_cursor']}",
        headers=admin_headers,
    )
    assert second_page.status_code == 200
    second_payload = second_page.json()
    assert len(second_payload["items"]) == 1
    assert second_payload["next_cursor"] is None

    filtered = client.get(
        f"/v1/sessions/{session_id}/events?event_type=sql_query_run",
        headers=admin_headers,
    )
    assert filtered.status_code == 200
    filtered_payload = filtered.json()
    assert len(filtered_payload["items"]) == 1
    assert filtered_payload["items"][0]["event_type"] == "sql_query_run"


def test_list_session_events_candidate_mismatch_is_hidden(client, admin_headers):
    session_id = _bootstrap_session(client, admin_headers)
    other_candidate_token = issue_access_token(role="candidate", user_id="candidate_2", tenant_id="tenant_a").access_token
    other_candidate_headers = {"Authorization": f"Bearer {other_candidate_token}"}

    response = client.get(f"/v1/sessions/{session_id}/events", headers=other_candidate_headers)
    assert response.status_code == 404
