from app.services.jobs import process_jobs_until_empty


def _job_result(client, job_id, headers):
    process_jobs_until_empty()
    response = client.get(f"/v1/jobs/{job_id}/result", headers=headers)
    assert response.status_code == 200
    return response.json()["result"]


def _create_scored_session(client, admin_headers, reviewer_headers, candidate_headers):
    case_response = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "Summary Endpoint Case",
            "scenario": "Investigate retention drop and propose root-cause hypotheses.",
            "artifacts": [{"type": "csv", "name": "retention.csv"}],
            "metrics": [],
            "allowed_tools": ["sql_workspace", "copilot"],
        },
    )
    assert case_response.status_code == 201
    case_id = case_response.json()["id"]

    generate_response = client.post(
        f"/v1/cases/{case_id}/generate",
        headers={**admin_headers, "Idempotency-Key": "report-summary-generate-1"},
    )
    assert generate_response.status_code == 202
    generate_payload = _job_result(client, generate_response.json()["job_id"], admin_headers)
    task_family_id = generate_payload["task_family"]["id"]

    review_response = client.post(
        f"/v1/task-families/{task_family_id}/review",
        headers=reviewer_headers,
        json={"decision": "approve", "review_note": "ready"},
    )
    assert review_response.status_code == 200
    publish_response = client.post(
        f"/v1/task-families/{task_family_id}/publish",
        headers=reviewer_headers,
        json={"approver_note": "publish"},
    )
    assert publish_response.status_code == 200

    session_response = client.post(
        "/v1/sessions",
        headers=reviewer_headers,
        json={
            "task_family_id": task_family_id,
            "candidate_id": "candidate_1",
            "policy": {"raw_content_opt_in": False, "retention_ttl_days": 30},
        },
    )
    assert session_response.status_code == 201
    session_id = session_response.json()["id"]

    ingest_response = client.post(
        f"/v1/sessions/{session_id}/events",
        headers=candidate_headers,
        json={
            "events": [
                {"event_type": "sql_query_run", "payload": {"time_to_first_action_ms": 700}},
                {"event_type": "verification_step_completed", "payload": {}},
            ]
        },
    )
    assert ingest_response.status_code == 202

    submit_response = client.post(
        f"/v1/sessions/{session_id}/submit",
        headers=candidate_headers,
        json={"final_response": "I would isolate cohort anomalies before escalation."},
    )
    assert submit_response.status_code == 200

    score_response = client.post(
        f"/v1/sessions/{session_id}/score",
        headers={**reviewer_headers, "Idempotency-Key": "report-summary-score-1"},
    )
    assert score_response.status_code == 202
    _job_result(client, score_response.json()["job_id"], reviewer_headers)

    return session_id


def test_report_summary_for_scored_session(client, admin_headers, reviewer_headers, candidate_headers):
    session_id = _create_scored_session(client, admin_headers, reviewer_headers, candidate_headers)

    response = client.get(f"/v1/reports/{session_id}/summary", headers=reviewer_headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["session_id"] == session_id
    assert payload["session_status"] == "scored"
    assert payload["report_available"] is True
    assert isinstance(payload["confidence"], float)
    assert isinstance(payload["needs_human_review"], bool)
    assert isinstance(payload["trigger_codes"], list)
    assert payload["trigger_count"] == len(payload["trigger_codes"])
    assert isinstance(payload["last_scored_at"], str)
    assert payload["scoring_version_lock"]["scorer_version"] == "0.2.0"
    assert payload["has_human_review"] is False
    assert payload["final_score_source"] == "model"
    assert isinstance(payload["final_confidence"], float)


def test_report_summary_for_active_session_without_report(client, admin_headers, reviewer_headers):
    case_response = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "Summary Empty Report Case",
            "scenario": "Inspect active user dip.",
            "artifacts": [],
            "metrics": [],
            "allowed_tools": ["sql_workspace"],
        },
    )
    assert case_response.status_code == 201
    case_id = case_response.json()["id"]

    generate_response = client.post(
        f"/v1/cases/{case_id}/generate",
        headers={**admin_headers, "Idempotency-Key": "report-summary-generate-2"},
    )
    assert generate_response.status_code == 202
    generate_payload = _job_result(client, generate_response.json()["job_id"], admin_headers)
    task_family_id = generate_payload["task_family"]["id"]

    client.post(
        f"/v1/task-families/{task_family_id}/review",
        headers=reviewer_headers,
        json={"decision": "approve"},
    )
    client.post(
        f"/v1/task-families/{task_family_id}/publish",
        headers=reviewer_headers,
        json={"approver_note": "publish"},
    )

    session_response = client.post(
        "/v1/sessions",
        headers=reviewer_headers,
        json={
            "task_family_id": task_family_id,
            "candidate_id": "candidate_2",
            "policy": {"raw_content_opt_in": False, "retention_ttl_days": 30},
        },
    )
    assert session_response.status_code == 201
    session_id = session_response.json()["id"]

    response = client.get(f"/v1/reports/{session_id}/summary", headers=reviewer_headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["session_id"] == session_id
    assert payload["session_status"] == "active"
    assert payload["report_available"] is False
    assert payload["confidence"] is None
    assert payload["needs_human_review"] is None
    assert payload["trigger_codes"] == []
    assert payload["trigger_count"] == 0
    assert payload["last_scored_at"] is None
    assert payload["has_human_review"] is False
    assert payload["final_score_source"] is None
    assert payload["final_confidence"] is None


def test_report_human_review_crud_and_summary_override(
    client, admin_headers, reviewer_headers, candidate_headers
):
    session_id = _create_scored_session(client, admin_headers, reviewer_headers, candidate_headers)

    initial = client.get(
        f"/v1/reports/{session_id}/human-review",
        headers=reviewer_headers,
    )
    assert initial.status_code == 200
    assert initial.json()["session_id"] == session_id
    assert initial.json()["notes_markdown"] is None
    assert initial.json()["override_overall_score"] is None

    updated = client.put(
        f"/v1/reports/{session_id}/human-review",
        headers=reviewer_headers,
        json={
            "notes_markdown": "Candidate solved SQL checks well but escalated late.",
            "tags": ["late_escalation", "strong_sql"],
            "override_overall_score": 0.74,
            "override_confidence": 0.71,
            "dimension_overrides": {"sql_quality": 0.86, "communication": 0.62},
        },
    )
    assert updated.status_code == 200
    payload = updated.json()
    assert payload["session_id"] == session_id
    assert payload["notes_markdown"].startswith("Candidate solved SQL checks")
    assert payload["tags"] == ["late_escalation", "strong_sql"]
    assert payload["override_overall_score"] == 0.74
    assert payload["override_confidence"] == 0.71
    assert payload["dimension_overrides"]["communication"] == 0.62
    assert payload["reviewer_id"] == "reviewer_1"

    summary = client.get(f"/v1/reports/{session_id}/summary", headers=reviewer_headers)
    assert summary.status_code == 200
    summary_payload = summary.json()
    assert summary_payload["has_human_review"] is True
    assert summary_payload["final_score_source"] == "human_override"
    assert summary_payload["final_confidence"] == 0.71


def test_report_human_review_candidate_forbidden(
    client, admin_headers, reviewer_headers, candidate_headers
):
    session_id = _create_scored_session(client, admin_headers, reviewer_headers, candidate_headers)
    forbidden = client.put(
        f"/v1/reports/{session_id}/human-review",
        headers=candidate_headers,
        json={"notes_markdown": "attempt"},
    )
    assert forbidden.status_code == 403
