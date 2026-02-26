def _prepare_scored_session(client, admin_headers, reviewer_headers, candidate_headers):
    case_res = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "Scoring Case",
            "scenario": "Investigate conversion drop",
            "artifacts": [],
            "metrics": [],
            "allowed_tools": ["sql_workspace", "copilot"],
        },
    )
    case_id = case_res.json()["id"]
    gen_res = client.post(f"/v1/cases/{case_id}/generate", headers=admin_headers)
    task_family_id = gen_res.json()["task_family"]["id"]
    client.post(f"/v1/task-families/{task_family_id}/publish", headers=reviewer_headers, json={})

    session_res = client.post(
        "/v1/sessions",
        headers=reviewer_headers,
        json={"task_family_id": task_family_id, "candidate_id": "candidate_1", "policy": {"raw_content_opt_in": False}},
    )
    session_id = session_res.json()["id"]

    events = {
        "events": [
            {"event_type": "sql_query_run", "payload": {"time_to_first_action_ms": 1200}},
            {"event_type": "sql_query_error", "payload": {}},
            {"event_type": "copilot_invoked", "payload": {}},
            {"event_type": "verification_step_completed", "payload": {}},
        ]
    }
    ingest = client.post(f"/v1/sessions/{session_id}/events", headers=candidate_headers, json=events)
    assert ingest.status_code == 202

    submit = client.post(f"/v1/sessions/{session_id}/submit", headers=candidate_headers, json={"final_response": "summary"})
    assert submit.status_code == 200

    score = client.post(f"/v1/sessions/{session_id}/score", headers=reviewer_headers)
    assert score.status_code == 200
    return session_id


def test_report_and_export_flow(client, admin_headers, reviewer_headers, candidate_headers):
    session_id = _prepare_scored_session(client, admin_headers, reviewer_headers, candidate_headers)

    report = client.get(f"/v1/reports/{session_id}", headers=reviewer_headers)
    assert report.status_code == 200
    report_payload = report.json()
    assert "score_result" in report_payload
    assert "objective_metrics" in report_payload["score_result"]

    audit = client.get("/v1/audit-logs", headers=admin_headers)
    assert audit.status_code == 200
    export_run_id = None
    for item in audit.json()["items"]:
        if item["action"] == "score":
            export_run_id = item["metadata"]["export_run_id"]
            break
    assert export_run_id is not None

    export_resp = client.get(f"/v1/exports/{export_run_id}", headers=reviewer_headers)
    assert export_resp.status_code == 200
    export_payload = export_resp.json()
    assert "session_id,confidence,needs_human_review" in export_payload["csv"]
    assert "tableau_schema" in export_payload
