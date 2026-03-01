from app.services.jobs import process_jobs_until_empty


def _create_generated_task_family(client, admin_headers):
    case = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "Time Limit Case",
            "scenario": "Test time_limit_minutes round-trip.",
            "artifacts": [],
            "metrics": [],
            "allowed_tools": ["sql_workspace"],
        },
    )
    assert case.status_code == 201
    case_id = case.json()["id"]

    gen = client.post(
        f"/v1/cases/{case_id}/generate",
        headers={**admin_headers, "Idempotency-Key": "time-limit-gen-1"},
    )
    assert gen.status_code == 202
    process_jobs_until_empty()

    result = client.get(f"/v1/jobs/{gen.json()['job_id']}/result", headers=admin_headers)
    assert result.status_code == 200
    tf_id = result.json()["result"]["task_family"]["id"]

    client.post(
        f"/v1/task-families/{tf_id}/review",
        headers=admin_headers,
        json={"decision": "approve"},
    )
    client.post(f"/v1/task-families/{tf_id}/publish", headers=admin_headers, json={})
    return tf_id


def test_time_limit_minutes_round_trips(client, admin_headers):
    tf_id = _create_generated_task_family(client, admin_headers)

    create_resp = client.post(
        "/v1/sessions",
        headers=admin_headers,
        json={
            "task_family_id": tf_id,
            "candidate_id": "candidate_1",
            "policy": {
                "raw_content_opt_in": False,
                "retention_ttl_days": 90,
                "time_limit_minutes": 60,
            },
        },
    )
    assert create_resp.status_code == 201
    session_id = create_resp.json()["id"]

    get_resp = client.get(f"/v1/sessions/{session_id}", headers=admin_headers)
    assert get_resp.status_code == 200
    policy = get_resp.json()["policy"]
    assert policy["time_limit_minutes"] == 60
    assert isinstance(get_resp.json().get("task_prompt"), str)
    assert get_resp.json()["task_prompt"].strip() != ""


def test_time_limit_minutes_defaults_to_none(client, admin_headers):
    tf_id = _create_generated_task_family(client, admin_headers)

    create_resp = client.post(
        "/v1/sessions",
        headers=admin_headers,
        json={
            "task_family_id": tf_id,
            "candidate_id": "candidate_1",
        },
    )
    assert create_resp.status_code == 201
    policy = create_resp.json()["policy"]
    assert policy.get("time_limit_minutes") is None
