from datetime import datetime, timedelta, timezone

from app.services.jobs import process_jobs_until_empty


def _job_result(client, job_id, headers):
    process_jobs_until_empty()
    response = client.get(f"/v1/jobs/{job_id}/result", headers=headers)
    assert response.status_code == 200
    return response.json()["result"]


def _bootstrap_published_task_family(client, admin_headers):
    case = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "Policy Case",
            "scenario": "Analyze policy-driven retention behavior.",
            "artifacts": [],
            "metrics": [],
            "allowed_tools": ["sql_workspace"],
        },
    )
    assert case.status_code == 201
    case_id = case.json()["id"]
    generated = client.post(
        f"/v1/cases/{case_id}/generate",
        headers={**admin_headers, "Idempotency-Key": "admin-policy-gen-1"},
    )
    assert generated.status_code == 202
    task_family_id = _job_result(client, generated.json()["job_id"], admin_headers)["task_family"]["id"]

    reviewed = client.post(
        f"/v1/task-families/{task_family_id}/review",
        headers=admin_headers,
        json={"decision": "approve", "review_note": "ready"},
    )
    assert reviewed.status_code == 200
    published = client.post(
        f"/v1/task-families/{task_family_id}/publish",
        headers=admin_headers,
        json={},
    )
    assert published.status_code == 200
    return task_family_id


def test_admin_policy_defaults_and_patch(client, admin_headers, reviewer_headers):
    default_policy = client.get("/v1/admin/policies", headers=admin_headers)
    assert default_policy.status_code == 200
    assert default_policy.json()["raw_content_default_opt_in"] is False
    assert default_policy.json()["default_retention_ttl_days"] == 90

    forbidden = client.patch(
        "/v1/admin/policies",
        headers=reviewer_headers,
        json={"default_retention_ttl_days": 45},
    )
    assert forbidden.status_code == 403

    updated = client.patch(
        "/v1/admin/policies",
        headers=admin_headers,
        json={"default_retention_ttl_days": 45, "max_retention_ttl_days": 120},
    )
    assert updated.status_code == 200
    assert updated.json()["default_retention_ttl_days"] == 45
    assert updated.json()["max_retention_ttl_days"] == 120


def test_session_creation_uses_admin_policy_defaults(client, admin_headers):
    task_family_id = _bootstrap_published_task_family(client, admin_headers)
    updated = client.patch(
        "/v1/admin/policies",
        headers=admin_headers,
        json={"default_retention_ttl_days": 10},
    )
    assert updated.status_code == 200

    session = client.post(
        "/v1/sessions",
        headers=admin_headers,
        json={"task_family_id": task_family_id, "candidate_id": "candidate_1", "policy": {"raw_content_opt_in": False}},
    )
    assert session.status_code == 201
    assert session.json()["policy"]["retention_ttl_days"] == 10


def test_admin_can_purge_expired_raw_content(client, admin_headers, candidate_headers):
    task_family_id = _bootstrap_published_task_family(client, admin_headers)

    session = client.post(
        "/v1/sessions",
        headers=admin_headers,
        json={
            "task_family_id": task_family_id,
            "candidate_id": "candidate_1",
            "policy": {"raw_content_opt_in": True, "retention_ttl_days": 1},
        },
    )
    assert session.status_code == 201
    session_id = session.json()["id"]

    submit = client.post(
        f"/v1/sessions/{session_id}/submit",
        headers=candidate_headers,
        json={"final_response": "sensitive answer body"},
    )
    assert submit.status_code == 200

    from app.services.store import store

    created_at = datetime.now(timezone.utc) - timedelta(days=3)
    session_key = next(key for key in store.sessions if str(key) == session_id)
    row = store.sessions[session_key]
    row["created_at"] = created_at.isoformat()
    row["updated_at"] = created_at.isoformat()
    store.sessions[session_key] = row

    purge = client.post("/v1/admin/policies/purge-expired", headers=admin_headers, json={})
    assert purge.status_code == 200
    assert purge.json()["purged_sessions"] == 1

    session_after = client.get(f"/v1/sessions/{session_id}", headers=admin_headers)
    assert session_after.status_code == 200
    assert session_after.json().get("final_response") in (None, "")
