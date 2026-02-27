from app.services.jobs import process_jobs_until_empty


def _job_result(client, job_id, headers):
    process_jobs_until_empty()
    response = client.get(f"/v1/jobs/{job_id}/result", headers=headers)
    assert response.status_code == 200
    return response.json()["result"]


def _create_published_task_family(client, admin_headers, reviewer_headers):
    case_res = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "Evidence Loop Case",
            "scenario": "Investigate conversion drop and propose mitigations.",
            "artifacts": [{"type": "query_log", "name": "query_history.csv"}],
            "metrics": [],
            "allowed_tools": ["sql_workspace", "dashboard_workspace", "copilot"],
        },
    )
    assert case_res.status_code == 201
    case_id = case_res.json()["id"]

    generate = client.post(
        f"/v1/cases/{case_id}/generate",
        headers={**admin_headers, "Idempotency-Key": "evidence-loops-generate-1"},
    )
    assert generate.status_code == 202
    generated = _job_result(client, generate.json()["job_id"], admin_headers)
    task_family_id = generated["task_family"]["id"]

    review = client.post(
        f"/v1/task-families/{task_family_id}/review",
        headers=reviewer_headers,
        json={"decision": "approve", "review_note": "quality approved"},
    )
    assert review.status_code == 200
    publish = client.post(
        f"/v1/task-families/{task_family_id}/publish",
        headers=reviewer_headers,
        json={"approver_note": "publish"},
    )
    assert publish.status_code == 200
    return task_family_id


def _create_submitted_session(client, admin_headers, reviewer_headers, candidate_headers):
    task_family_id = _create_published_task_family(client, admin_headers, reviewer_headers)
    session = client.post(
        "/v1/sessions",
        headers=reviewer_headers,
        json={
            "task_family_id": task_family_id,
            "candidate_id": "candidate_1",
            "policy": {"raw_content_opt_in": False, "retention_ttl_days": 30},
        },
    )
    assert session.status_code == 201
    session_id = session.json()["id"]

    ingest = client.post(
        f"/v1/sessions/{session_id}/events",
        headers=candidate_headers,
        json={
            "events": [
                {"event_type": "copilot_invoked", "payload": {"time_to_first_action_ms": 1200}},
                {"event_type": "verification_step_completed", "payload": {}},
            ]
        },
    )
    assert ingest.status_code == 202
    submit = client.post(
        f"/v1/sessions/{session_id}/submit",
        headers=candidate_headers,
        json={"final_response": "Escalate with caveats and validation plan."},
    )
    assert submit.status_code == 200
    return session_id, task_family_id


def _create_scored_session(client, admin_headers, reviewer_headers, candidate_headers):
    session_id, _ = _create_submitted_session(client, admin_headers, reviewer_headers, candidate_headers)
    score = client.post(
        f"/v1/sessions/{session_id}/score",
        headers={**reviewer_headers, "Idempotency-Key": "evidence-loops-score-1"},
    )
    assert score.status_code == 202
    _job_result(client, score.json()["job_id"], reviewer_headers)
    return session_id


def test_task_family_quality_evaluate_and_get(client, admin_headers, reviewer_headers, candidate_headers):
    task_family_id = _create_published_task_family(client, admin_headers, reviewer_headers)

    forbidden = client.post(f"/v1/task-families/{task_family_id}/quality/evaluate", headers=candidate_headers)
    assert forbidden.status_code == 403

    evaluate = client.post(
        f"/v1/task-families/{task_family_id}/quality/evaluate",
        headers={**reviewer_headers, "Idempotency-Key": "quality-evaluate-1"},
    )
    assert evaluate.status_code == 202
    payload = _job_result(client, evaluate.json()["job_id"], reviewer_headers)
    assert payload["task_family_id"] == task_family_id
    assert payload["variant_count"] >= 3
    assert "quality_score" in payload
    assert payload["rubric_leakage_detected"] is False

    fetched = client.get(f"/v1/task-families/{task_family_id}/quality", headers=reviewer_headers)
    assert fetched.status_code == 200
    assert fetched.json()["quality_score"] == payload["quality_score"]


def test_coaching_mode_feedback_and_context_trace(client, admin_headers, reviewer_headers, candidate_headers):
    session_id, _ = _create_submitted_session(client, admin_headers, reviewer_headers, candidate_headers)

    mode = client.post(
        f"/v1/sessions/{session_id}/mode",
        headers=reviewer_headers,
        json={"mode": "practice"},
    )
    assert mode.status_code == 200
    assert mode.json()["policy"]["coach_mode"] == "practice"

    coach = client.post(
        f"/v1/sessions/{session_id}/coach/message",
        headers=candidate_headers,
        json={"message": "Can you remind me what to verify before escalating?"},
    )
    assert coach.status_code == 200
    assert coach.json()["policy_version"] is not None

    feedback = client.post(
        f"/v1/sessions/{session_id}/coach/feedback",
        headers=candidate_headers,
        json={"helpful": True, "confusion_tags": ["verification_steps"]},
    )
    assert feedback.status_code == 201
    assert feedback.json()["helpful"] is True

    traces = client.get(f"/v1/context/injection-traces/{session_id}", headers=reviewer_headers)
    assert traces.status_code == 200
    items = traces.json()["items"]
    assert len(items) >= 1
    assert items[0]["session_id"] == session_id
    assert "task_rubric" in items[0]["precedence_order"]


def test_report_interpretation_view_keeps_score_stable(client, admin_headers, reviewer_headers, candidate_headers):
    session_id = _create_scored_session(client, admin_headers, reviewer_headers, candidate_headers)

    baseline_report = client.get(f"/v1/reports/{session_id}", headers=reviewer_headers)
    assert baseline_report.status_code == 200
    baseline_confidence = baseline_report.json()["score_result"]["confidence"]

    interpret = client.post(
        f"/v1/reports/{session_id}/interpret",
        headers={**reviewer_headers, "Idempotency-Key": "interpretation-generate-1"},
        json={
            "focus_dimensions": ["sql_quality"],
            "include_sensitivity": True,
            "weight_overrides": {"sql_quality": 1.2, "communication": 0.8},
        },
    )
    assert interpret.status_code == 202
    payload = _job_result(client, interpret.json()["job_id"], reviewer_headers)
    assert payload["session_id"] == session_id
    assert payload["scoring_version_lock"]["scorer_version"] == "0.1.0"
    assert payload["include_sensitivity"] is True

    view_id = payload["view_id"]
    read_view = client.get(f"/v1/reports/{session_id}/interpretations/{view_id}", headers=reviewer_headers)
    assert read_view.status_code == 200
    assert read_view.json()["view_id"] == view_id

    report_after = client.get(f"/v1/reports/{session_id}", headers=reviewer_headers)
    assert report_after.status_code == 200
    assert report_after.json()["score_result"]["confidence"] == baseline_confidence


def test_fairness_smoke_runs_create_and_get(client, admin_headers, reviewer_headers, candidate_headers):
    _create_scored_session(client, admin_headers, reviewer_headers, candidate_headers)

    forbidden = client.post("/v1/fairness/smoke-runs", headers=reviewer_headers, json={"scope": "tenant_recent"})
    assert forbidden.status_code == 403

    created = client.post(
        "/v1/fairness/smoke-runs",
        headers={**admin_headers, "Idempotency-Key": "fairness-run-1"},
        json={"scope": "tenant_recent"},
    )
    assert created.status_code == 202
    payload = _job_result(client, created.json()["job_id"], admin_headers)
    assert payload["status"] == "completed"
    assert payload["scope"] == "tenant_recent"
    assert "group_metrics" in payload["summary"]

    run_id = payload["id"]
    fetched = client.get(f"/v1/fairness/smoke-runs/{run_id}", headers=admin_headers)
    assert fetched.status_code == 200
    assert fetched.json()["id"] == run_id
