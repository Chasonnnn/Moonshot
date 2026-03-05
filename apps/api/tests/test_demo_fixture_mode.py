from app.core.config import get_settings
from app.services.jobs import process_jobs_until_empty


def _job_result(client, job_id, headers):
    process_jobs_until_empty()
    response = client.get(f"/v1/jobs/{job_id}/result", headers=headers)
    assert response.status_code == 200
    return response.json()["result"]


def test_generate_fixture_mode_returns_deterministic_family(client, admin_headers):
    case_res = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "Fixture Generate Case",
            "scenario": "Fixture scenario",
            "artifacts": [],
            "metrics": [],
            "allowed_tools": ["sql_workspace", "python_workspace"],
        },
    )
    assert case_res.status_code == 201
    case_id = case_res.json()["id"]

    gen_res = client.post(
        f"/v1/cases/{case_id}/generate",
        headers={**admin_headers, "Idempotency-Key": "fixture-generate-1"},
        json={"mode": "fixture", "template_id": "tpl_jda_quality", "variant_count": 12},
    )
    assert gen_res.status_code == 202

    generated = _job_result(client, gen_res.json()["job_id"], admin_headers)
    task_family = generated["task_family"]
    rubric = generated["rubric"]

    assert task_family["id"]
    assert len(task_family["variants"]) == 12
    first_variant = task_family["variants"][0]
    assert first_variant["skill"]
    assert first_variant["difficulty_level"]
    assert first_variant["round_hint"]
    assert first_variant["estimated_minutes"] is not None
    assert isinstance(first_variant["deliverables"], list)
    assert isinstance(first_variant["artifact_refs"], list)
    assert rubric["id"]
    first_dimension = rubric["dimensions"][0]
    assert isinstance(first_dimension["evaluation_points"], list)
    assert isinstance(first_dimension["evidence_signals"], list)
    assert isinstance(first_dimension["common_failure_modes"], list)
    assert isinstance(first_dimension["score_bands"], dict)
    rubric_keys = {item["key"] for item in rubric["dimensions"]}
    assert "sql_accuracy" in rubric_keys
    assert "data_quality_process" in rubric_keys


def test_generate_fixture_mode_supports_doordash_enablement_template(client, admin_headers):
    case_res = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "DoorDash Fixture Generate Case",
            "scenario": "DoorDash fixture scenario",
            "artifacts": [],
            "metrics": [],
            "allowed_tools": ["sql_workspace", "python_workspace", "dashboard_workspace"],
        },
    )
    assert case_res.status_code == 201
    case_id = case_res.json()["id"]

    gen_res = client.post(
        f"/v1/cases/{case_id}/generate",
        headers={**admin_headers, "Idempotency-Key": "fixture-generate-doordash-1"},
        json={"mode": "fixture", "template_id": "tpl_doordash_enablement", "variant_count": 12},
    )
    assert gen_res.status_code == 202

    generated = _job_result(client, gen_res.json()["job_id"], admin_headers)
    task_family = generated["task_family"]
    rubric = generated["rubric"]

    assert task_family["id"]
    assert len(task_family["variants"]) == 12
    rubric_keys = {item["key"] for item in rubric["dimensions"]}
    assert "problem_framing" in rubric_keys
    assert "analysis_correctness" in rubric_keys
    assert "recommendation_quality" in rubric_keys
    assert "tradeoff_roi_rigor" in rubric_keys
    assert "communication_story" in rubric_keys
    assert "sql_proficiency" in rubric_keys


def test_score_fixture_mode_uses_fixture_score_payload(client, admin_headers, reviewer_headers, candidate_headers):
    case_res = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "Fixture Score Case",
            "scenario": "Fixture score scenario",
            "artifacts": [],
            "metrics": [],
            "allowed_tools": ["sql_workspace", "python_workspace"],
        },
    )
    assert case_res.status_code == 201
    case_id = case_res.json()["id"]

    gen_res = client.post(
        f"/v1/cases/{case_id}/generate",
        headers={**admin_headers, "Idempotency-Key": "fixture-generate-2"},
        json={"mode": "fixture", "template_id": "tpl_jda_quality"},
    )
    assert gen_res.status_code == 202
    generated = _job_result(client, gen_res.json()["job_id"], admin_headers)
    task_family_id = generated["task_family"]["id"]

    review = client.post(
        f"/v1/task-families/{task_family_id}/review",
        headers=reviewer_headers,
        json={"decision": "approve"},
    )
    assert review.status_code == 200
    publish = client.post(f"/v1/task-families/{task_family_id}/publish", headers=reviewer_headers, json={})
    assert publish.status_code == 200

    session_res = client.post(
        "/v1/sessions",
        headers=reviewer_headers,
        json={
            "task_family_id": task_family_id,
            "candidate_id": "candidate_1",
            "policy": {
                "raw_content_opt_in": False,
                "retention_ttl_days": 30,
                "demo_template_id": "tpl_jda_quality",
            },
        },
    )
    assert session_res.status_code == 201
    session_id = session_res.json()["id"]

    ingest = client.post(
        f"/v1/sessions/{session_id}/events",
        headers=candidate_headers,
        json={"events": [{"event_type": "sql_query_run", "payload": {"runtime_ms": 31}}]},
    )
    assert ingest.status_code == 202

    submit = client.post(
        f"/v1/sessions/{session_id}/submit",
        headers=candidate_headers,
        json={"final_response": "fixture response"},
    )
    assert submit.status_code == 200

    score_res = client.post(
        f"/v1/sessions/{session_id}/score",
        headers={**reviewer_headers, "Idempotency-Key": "fixture-score-1"},
        json={"mode": "fixture", "template_id": "tpl_jda_quality"},
    )
    assert score_res.status_code == 202

    scored = _job_result(client, score_res.json()["job_id"], reviewer_headers)
    assert scored["confidence"] == 0.82
    assert scored["dimension_scores"]["sql_accuracy"] == 0.8
    assert "dimension_evidence" in scored
    assert "sql_accuracy" in scored["dimension_evidence"]
    assert "fixture_score_profile" in scored["trigger_codes"]


def test_score_fixture_mode_uses_doordash_enablement_score_profile(
    client, admin_headers, reviewer_headers, candidate_headers
):
    case_res = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "DoorDash Fixture Score Case",
            "scenario": "DoorDash fixture score scenario",
            "artifacts": [],
            "metrics": [],
            "allowed_tools": ["sql_workspace", "python_workspace", "dashboard_workspace"],
        },
    )
    assert case_res.status_code == 201
    case_id = case_res.json()["id"]

    gen_res = client.post(
        f"/v1/cases/{case_id}/generate",
        headers={**admin_headers, "Idempotency-Key": "fixture-generate-doordash-2"},
        json={"mode": "fixture", "template_id": "tpl_doordash_enablement"},
    )
    assert gen_res.status_code == 202
    generated = _job_result(client, gen_res.json()["job_id"], admin_headers)
    task_family_id = generated["task_family"]["id"]

    review = client.post(
        f"/v1/task-families/{task_family_id}/review",
        headers=reviewer_headers,
        json={"decision": "approve"},
    )
    assert review.status_code == 200
    publish = client.post(f"/v1/task-families/{task_family_id}/publish", headers=reviewer_headers, json={})
    assert publish.status_code == 200

    session_res = client.post(
        "/v1/sessions",
        headers=reviewer_headers,
        json={
            "task_family_id": task_family_id,
            "candidate_id": "candidate_1",
            "policy": {
                "raw_content_opt_in": False,
                "retention_ttl_days": 30,
                "demo_template_id": "tpl_doordash_enablement",
            },
        },
    )
    assert session_res.status_code == 201
    session_id = session_res.json()["id"]

    ingest = client.post(
        f"/v1/sessions/{session_id}/events",
        headers=candidate_headers,
        json={
            "events": [
                {"event_type": "sql_query_run", "payload": {"runtime_ms": 31}},
                {"event_type": "python_code_run", "payload": {"runtime_ms": 44}},
                {"event_type": "dashboard_action", "payload": {"action": "annotate"}},
                {"event_type": "verification_step_completed", "payload": {"step": "roi_sanity_check"}},
            ]
        },
    )
    assert ingest.status_code == 202

    submit = client.post(
        f"/v1/sessions/{session_id}/submit",
        headers=candidate_headers,
        json={"final_response": "doordash fixture response"},
    )
    assert submit.status_code == 200

    score_res = client.post(
        f"/v1/sessions/{session_id}/score",
        headers={**reviewer_headers, "Idempotency-Key": "fixture-score-doordash-1"},
        json={"mode": "fixture", "template_id": "tpl_doordash_enablement"},
    )
    assert score_res.status_code == 202

    scored = _job_result(client, score_res.json()["job_id"], reviewer_headers)
    assert scored["confidence"] == 0.89
    assert scored["dimension_scores"]["sql_proficiency"] == 0.86
    assert scored["dimension_scores"]["tradeoff_roi_rigor"] == 0.9
    assert "fixture_score_profile" in scored["trigger_codes"]


def test_generate_fixture_mode_rejects_unknown_template(client, admin_headers, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "worker_max_attempts_default", 1)

    case_res = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "Fixture Unknown Template",
            "scenario": "Fixture scenario",
            "artifacts": [],
            "metrics": [],
            "allowed_tools": ["sql_workspace", "python_workspace"],
        },
    )
    assert case_res.status_code == 201
    case_id = case_res.json()["id"]

    gen_res = client.post(
        f"/v1/cases/{case_id}/generate",
        headers={**admin_headers, "Idempotency-Key": "fixture-generate-unknown-template"},
        json={"mode": "fixture", "template_id": "tpl_unknown"},
    )
    assert gen_res.status_code == 202

    process_jobs_until_empty()
    result_res = client.get(f"/v1/jobs/{gen_res.json()['job_id']}/result", headers=admin_headers)
    assert result_res.status_code == 200
    payload = result_res.json()
    assert payload["status"] == "failed_permanent"
    assert payload["result"]["error_code"] == "validation_error"
    assert "fixture_template_not_found" in payload["result"]["error_detail"]
