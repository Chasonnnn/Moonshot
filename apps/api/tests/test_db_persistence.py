from sqlalchemy import func, select

from app.db.session import SessionLocal
from app.models.entities import CaseSpecModel, EventLogModel, ScoreResultModel


def _bootstrap_submitted_session(client, admin_headers, reviewer_headers, candidate_headers):
    case_res = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "Persistence Case",
            "scenario": "Investigate conversion drop",
            "artifacts": [],
            "metrics": [],
            "allowed_tools": ["sql_workspace", "copilot"],
        },
    )
    assert case_res.status_code == 201
    case_id = case_res.json()["id"]

    gen_res = client.post(f"/v1/cases/{case_id}/generate", headers=admin_headers)
    assert gen_res.status_code == 200
    task_family_id = gen_res.json()["task_family"]["id"]

    review = client.post(
        f"/v1/task-families/{task_family_id}/review",
        headers=reviewer_headers,
        json={"decision": "approve", "review_note": "ready"},
    )
    assert review.status_code == 200

    publish = client.post(f"/v1/task-families/{task_family_id}/publish", headers=reviewer_headers, json={})
    assert publish.status_code == 200

    session_res = client.post(
        "/v1/sessions",
        headers=reviewer_headers,
        json={"task_family_id": task_family_id, "candidate_id": "candidate_1", "policy": {"raw_content_opt_in": False}},
    )
    assert session_res.status_code == 201
    session_id = session_res.json()["id"]

    submit = client.post(
        f"/v1/sessions/{session_id}/submit",
        headers=candidate_headers,
        json={"final_response": "summary"},
    )
    assert submit.status_code == 200
    return case_id, session_id


def test_case_create_persists_to_database(client, admin_headers):
    response = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "DB Persisted Case",
            "scenario": "Check persistence",
            "artifacts": [],
            "metrics": [],
            "allowed_tools": [],
        },
    )
    assert response.status_code == 201
    case_id = response.json()["id"]

    with SessionLocal() as db:
        row = db.get(CaseSpecModel, case_id)
        assert row is not None
        assert row.tenant_id == "tenant_a"


def test_events_and_scores_persist_to_database(client, admin_headers, reviewer_headers, candidate_headers):
    _, session_id = _bootstrap_submitted_session(client, admin_headers, reviewer_headers, candidate_headers)

    ingest = client.post(
        f"/v1/sessions/{session_id}/events",
        headers=candidate_headers,
        json={
            "events": [
                {"event_type": "sql_query_run", "payload": {"time_to_first_action_ms": 1500}},
                {"event_type": "verification_step_completed", "payload": {}},
            ]
        },
    )
    assert ingest.status_code == 202

    score = client.post(f"/v1/sessions/{session_id}/score", headers=reviewer_headers)
    assert score.status_code == 200

    with SessionLocal() as db:
        event_count = db.scalar(
            select(func.count()).select_from(EventLogModel).where(EventLogModel.session_id == session_id)
        )
        assert event_count >= 2

        score_row = db.execute(
            select(ScoreResultModel).where(ScoreResultModel.session_id == session_id)
        ).scalars().first()
        assert score_row is not None
        assert score_row.confidence >= 0.0
