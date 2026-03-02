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
        json={"mode": "fixture", "template_id": "tpl_jda_quality"},
    )
    assert gen_res.status_code == 202

    generated = _job_result(client, gen_res.json()["job_id"], admin_headers)
    task_family = generated["task_family"]
    rubric = generated["rubric"]

    assert task_family["id"]
    assert len(task_family["variants"]) >= 3
    assert rubric["id"]
    rubric_keys = {item["key"] for item in rubric["dimensions"]}
    assert "sql_accuracy" in rubric_keys
    assert "data_quality_process" in rubric_keys


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
    assert "fixture_score_profile" in scored["trigger_codes"]
