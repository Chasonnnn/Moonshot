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
    gen_res = client.post(f"/v1/cases/{case_id}/generate", headers=admin_headers)
    tf_id = gen_res.json()["task_family"]["id"]
    client.post(f"/v1/task-families/{tf_id}/publish", headers=admin_headers, json={})
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
