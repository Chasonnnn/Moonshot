def _create_live_session(client, admin_headers, candidate_id="candidate_1"):
    case = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "Simulator Case",
            "scenario": "Investigate anomaly and communicate findings.",
            "artifacts": [],
            "metrics": [],
            "allowed_tools": ["sql_workspace", "dashboard_workspace"],
        },
    )
    assert case.status_code == 201
    case_id = case.json()["id"]
    gen = client.post(f"/v1/cases/{case_id}/generate", headers=admin_headers)
    assert gen.status_code == 200
    task_family_id = gen.json()["task_family"]["id"]
    review = client.post(
        f"/v1/task-families/{task_family_id}/review",
        headers=admin_headers,
        json={"decision": "approve", "review_note": "ready"},
    )
    assert review.status_code == 200
    publish = client.post(f"/v1/task-families/{task_family_id}/publish", headers=admin_headers, json={})
    assert publish.status_code == 200

    session = client.post(
        "/v1/sessions",
        headers=admin_headers,
        json={"task_family_id": task_family_id, "candidate_id": candidate_id, "policy": {"raw_content_opt_in": False}},
    )
    assert session.status_code == 201
    return session.json()["id"]


def test_sql_run_and_history(client, admin_headers, candidate_headers, reviewer_headers):
    session_id = _create_live_session(client, admin_headers)

    run = client.post(
        f"/v1/sessions/{session_id}/sql/run",
        headers=candidate_headers,
        json={"query": "SELECT * FROM funnel_metrics LIMIT 5;"},
    )
    assert run.status_code == 200
    payload = run.json()
    assert payload["ok"] is True
    assert payload["row_count"] >= 0
    assert payload["columns"]

    history_candidate = client.get(f"/v1/sessions/{session_id}/sql/history", headers=candidate_headers)
    assert history_candidate.status_code == 200
    assert len(history_candidate.json()["items"]) == 1

    history_reviewer = client.get(f"/v1/sessions/{session_id}/sql/history", headers=reviewer_headers)
    assert history_reviewer.status_code == 200
    assert len(history_reviewer.json()["items"]) == 1


def test_sql_run_blocks_dangerous_queries(client, admin_headers, candidate_headers):
    session_id = _create_live_session(client, admin_headers)
    run = client.post(
        f"/v1/sessions/{session_id}/sql/run",
        headers=candidate_headers,
        json={"query": "DROP TABLE users;"},
    )
    assert run.status_code == 400
    assert "disallowed" in run.json()["detail"]


def test_dashboard_state_and_action(client, admin_headers, candidate_headers, reviewer_headers):
    session_id = _create_live_session(client, admin_headers)

    state = client.get(f"/v1/sessions/{session_id}/dashboard/state", headers=candidate_headers)
    assert state.status_code == 200
    assert state.json()["filters"] == {}

    action = client.post(
        f"/v1/sessions/{session_id}/dashboard/action",
        headers=candidate_headers,
        json={"action_type": "apply_filter", "payload": {"region": "NA"}},
    )
    assert action.status_code == 200
    assert action.json()["filters"]["region"] == "NA"

    reviewer_state = client.get(f"/v1/sessions/{session_id}/dashboard/state", headers=reviewer_headers)
    assert reviewer_state.status_code == 200
    assert reviewer_state.json()["filters"]["region"] == "NA"
