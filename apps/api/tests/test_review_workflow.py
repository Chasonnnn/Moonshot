from app.services.jobs import process_jobs_until_empty


def _job_result(client, job_id, headers):
    process_jobs_until_empty()
    response = client.get(f"/v1/jobs/{job_id}/result", headers=headers)
    assert response.status_code == 200
    return response.json()["result"]


def _create_generated_task_family(client, admin_headers):
    case_response = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "Review Workflow Case",
            "scenario": "Analyze conversion drop and explain uncertainty.",
            "artifacts": [],
            "metrics": [],
            "allowed_tools": ["sql_workspace", "copilot"],
        },
    )
    assert case_response.status_code == 201
    case_id = case_response.json()["id"]

    generated = client.post(
        f"/v1/cases/{case_id}/generate",
        headers={**admin_headers, "Idempotency-Key": "review-workflow-gen-1"},
    )
    assert generated.status_code == 202
    return _job_result(client, generated.json()["job_id"], admin_headers)["task_family"]["id"]


def _create_scored_session(client, admin_headers, reviewer_headers, candidate_headers):
    task_family_id = _create_generated_task_family(client, admin_headers)

    review = client.post(
        f"/v1/task-families/{task_family_id}/review",
        headers=reviewer_headers,
        json={"decision": "approve", "review_note": "rubric and variants look correct"},
    )
    assert review.status_code == 200

    publish = client.post(
        f"/v1/task-families/{task_family_id}/publish",
        headers=reviewer_headers,
        json={},
    )
    assert publish.status_code == 200

    session = client.post(
        "/v1/sessions",
        headers=reviewer_headers,
        json={"task_family_id": task_family_id, "candidate_id": "candidate_1", "policy": {"raw_content_opt_in": False}},
    )
    assert session.status_code == 201
    session_id = session.json()["id"]

    event_payload = {
        "events": [
            {"event_type": "copilot_invoked", "payload": {}},
            {"event_type": "sql_query_error", "payload": {"policy_violation": True}},
        ]
    }
    ingest = client.post(f"/v1/sessions/{session_id}/events", headers=candidate_headers, json=event_payload)
    assert ingest.status_code == 202

    submit = client.post(f"/v1/sessions/{session_id}/submit", headers=candidate_headers, json={"final_response": "answer"})
    assert submit.status_code == 200

    score = client.post(
        f"/v1/sessions/{session_id}/score",
        headers={**reviewer_headers, "Idempotency-Key": "review-workflow-score-1"},
    )
    assert score.status_code == 202
    score_payload = _job_result(client, score.json()["job_id"], reviewer_headers)
    assert score_payload["needs_human_review"] is True
    return session_id


def test_publish_requires_approved_review_state(client, admin_headers, reviewer_headers):
    task_family_id = _create_generated_task_family(client, admin_headers)

    publish_without_review = client.post(
        f"/v1/task-families/{task_family_id}/publish",
        headers=reviewer_headers,
        json={},
    )
    assert publish_without_review.status_code == 400

    approve = client.post(
        f"/v1/task-families/{task_family_id}/review",
        headers=reviewer_headers,
        json={"decision": "approve", "review_note": "ready"},
    )
    assert approve.status_code == 200
    assert approve.json()["status"] == "approved"

    publish = client.post(
        f"/v1/task-families/{task_family_id}/publish",
        headers=reviewer_headers,
        json={"approver_note": "ship it"},
    )
    assert publish.status_code == 200
    assert publish.json()["status"] == "published"


def test_review_queue_lifecycle_for_human_review_sessions(client, admin_headers, reviewer_headers, candidate_headers):
    session_id = _create_scored_session(client, admin_headers, reviewer_headers, candidate_headers)

    queue = client.get("/v1/review-queue", headers=reviewer_headers)
    assert queue.status_code == 200
    items = queue.json()["items"]
    assert any(item["session_id"] == session_id for item in items)

    item = client.get(f"/v1/review-queue/{session_id}", headers=reviewer_headers)
    assert item.status_code == 200
    assert item.json()["status"] == "open"

    resolve = client.post(
        f"/v1/review-queue/{session_id}/resolve",
        headers=reviewer_headers,
        json={
            "decision": "confirmed",
            "reviewer_note": "confirmed needs-review risk and kept original score",
        },
    )
    assert resolve.status_code == 200
    assert resolve.json()["status"] == "resolved"

    queue_after = client.get("/v1/review-queue", headers=reviewer_headers)
    assert queue_after.status_code == 200
    assert all(item["session_id"] != session_id for item in queue_after.json()["items"])
