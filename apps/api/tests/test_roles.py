from app.services.jobs import process_jobs_until_empty


def _job_result(client, job_id, headers):
    process_jobs_until_empty()
    response = client.get(f"/v1/jobs/{job_id}/result", headers=headers)
    assert response.status_code == 200
    return response.json()["result"]


def _create_case(client, admin_headers):
    response = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "Weekly Funnel Drop",
            "scenario": "Activation conversion fell 15% WoW.",
            "artifacts": [],
            "metrics": [],
            "allowed_tools": ["sql_workspace"],
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def _create_task_family(client, admin_headers):
    case_id = _create_case(client, admin_headers)
    generated = client.post(
        f"/v1/cases/{case_id}/generate",
        headers={**admin_headers, "Idempotency-Key": "roles-gen-1"},
    )
    assert generated.status_code == 202
    task_family_id = _job_result(client, generated.json()["job_id"], admin_headers)["task_family"]["id"]

    review = client.post(
        f"/v1/task-families/{task_family_id}/review",
        headers=admin_headers,
        json={"decision": "approve", "review_note": "ready"},
    )
    assert review.status_code == 200
    published = client.post(f"/v1/task-families/{task_family_id}/publish", headers=admin_headers, json={})
    assert published.status_code == 200
    return task_family_id


def test_candidate_cannot_create_business_context_pack(client, candidate_headers):
    response = client.post(
        "/v1/business-context/packs",
        headers=candidate_headers,
        json={
            "name": "JDA",
            "role_focus": "junior_data_analyst",
            "job_description": "JD",
            "examples": [],
            "constraints": {},
        },
    )
    assert response.status_code == 403


def test_admin_can_create_business_context_pack(client, admin_headers):
    response = client.post(
        "/v1/business-context/packs",
        headers=admin_headers,
        json={
            "name": "JDA",
            "role_focus": "junior_data_analyst",
            "job_description": "JD",
            "examples": [],
            "constraints": {},
        },
    )
    assert response.status_code == 201


def test_candidate_cannot_score(client, admin_headers, candidate_headers):
    task_family_id = _create_task_family(client, admin_headers)
    session = client.post(
        "/v1/sessions",
        headers=admin_headers,
        json={"task_family_id": task_family_id, "candidate_id": "candidate_1", "policy": {"raw_content_opt_in": False}},
    )
    assert session.status_code == 201
    session_id = session.json()["id"]

    submit = client.post(
        f"/v1/sessions/{session_id}/submit",
        headers=candidate_headers,
        json={"final_response": "done"},
    )
    assert submit.status_code == 200

    score = client.post(
        f"/v1/sessions/{session_id}/score",
        headers={**candidate_headers, "Idempotency-Key": "roles-score-forbidden"},
    )
    assert score.status_code == 403
