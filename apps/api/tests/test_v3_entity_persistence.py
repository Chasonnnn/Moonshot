from sqlalchemy import func, select

from app.db.session import SessionLocal
from app.models.entities import (
    CoachFeedbackModel,
    ContextInjectionTraceModel,
    FairnessSmokeRunModel,
    InterpretationViewModel,
    TaskQualitySignalModel,
)
from app.services.jobs import process_jobs_until_empty


def _job_result(client, job_id, headers):
    process_jobs_until_empty()
    response = client.get(f"/v1/jobs/{job_id}/result", headers=headers)
    assert response.status_code == 200
    return response.json()["result"]


def _bootstrap_scored_session(client, admin_headers, reviewer_headers, candidate_headers):
    case_res = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "v3 persistence",
            "scenario": "Analyze anomaly and escalation.",
            "artifacts": [{"type": "query_log", "name": "events.csv"}],
            "metrics": [],
            "allowed_tools": ["sql_workspace", "copilot"],
        },
    )
    assert case_res.status_code == 201
    case_id = case_res.json()["id"]

    gen = client.post(
        f"/v1/cases/{case_id}/generate",
        headers={**admin_headers, "Idempotency-Key": "v3-persist-gen-1"},
    )
    assert gen.status_code == 202
    generated = _job_result(client, gen.json()["job_id"], admin_headers)
    task_family_id = generated["task_family"]["id"]

    review = client.post(
        f"/v1/task-families/{task_family_id}/review",
        headers=reviewer_headers,
        json={"decision": "approve", "review_note": "ready"},
    )
    assert review.status_code == 200
    publish = client.post(f"/v1/task-families/{task_family_id}/publish", headers=reviewer_headers, json={})
    assert publish.status_code == 200

    session = client.post(
        "/v1/sessions",
        headers=reviewer_headers,
        json={"task_family_id": task_family_id, "candidate_id": "candidate_1", "policy": {"raw_content_opt_in": False}},
    )
    assert session.status_code == 201
    session_id = session.json()["id"]

    events = client.post(
        f"/v1/sessions/{session_id}/events",
        headers=candidate_headers,
        json={"events": [{"event_type": "verification_step_completed", "payload": {"time_to_first_action_ms": 1100}}]},
    )
    assert events.status_code == 202

    submit = client.post(f"/v1/sessions/{session_id}/submit", headers=candidate_headers, json={"final_response": "done"})
    assert submit.status_code == 200

    score = client.post(
        f"/v1/sessions/{session_id}/score",
        headers={**reviewer_headers, "Idempotency-Key": "v3-persist-score-1"},
    )
    assert score.status_code == 202
    _job_result(client, score.json()["job_id"], reviewer_headers)
    return task_family_id, session_id


def test_v3_entities_persist_to_database(client, admin_headers, reviewer_headers, candidate_headers):
    task_family_id, session_id = _bootstrap_scored_session(client, admin_headers, reviewer_headers, candidate_headers)

    quality = client.post(
        f"/v1/task-families/{task_family_id}/quality/evaluate",
        headers={**reviewer_headers, "Idempotency-Key": "v3-quality-1"},
    )
    assert quality.status_code == 202
    _job_result(client, quality.json()["job_id"], reviewer_headers)

    mode = client.post(f"/v1/sessions/{session_id}/mode", headers=reviewer_headers, json={"mode": "practice"})
    assert mode.status_code == 200

    coach = client.post(
        f"/v1/sessions/{session_id}/coach/message",
        headers=candidate_headers,
        json={"message": "Help me validate before escalating."},
    )
    assert coach.status_code == 200

    feedback = client.post(
        f"/v1/sessions/{session_id}/coach/feedback",
        headers=candidate_headers,
        json={"helpful": True, "confusion_tags": ["evidence_check"]},
    )
    assert feedback.status_code == 201

    interpret = client.post(
        f"/v1/reports/{session_id}/interpret",
        headers={**reviewer_headers, "Idempotency-Key": "v3-interpret-1"},
        json={"focus_dimensions": ["sql_quality"], "include_sensitivity": True},
    )
    assert interpret.status_code == 202
    _job_result(client, interpret.json()["job_id"], reviewer_headers)

    fairness = client.post(
        "/v1/fairness/smoke-runs",
        headers={**admin_headers, "Idempotency-Key": "v3-fairness-1"},
        json={"scope": "tenant_recent"},
    )
    assert fairness.status_code == 202
    _job_result(client, fairness.json()["job_id"], admin_headers)

    with SessionLocal() as db:
        quality_count = db.scalar(select(func.count()).select_from(TaskQualitySignalModel))
        feedback_count = db.scalar(select(func.count()).select_from(CoachFeedbackModel))
        interpretation_count = db.scalar(select(func.count()).select_from(InterpretationViewModel))
        traces_count = db.scalar(select(func.count()).select_from(ContextInjectionTraceModel))
        fairness_count = db.scalar(select(func.count()).select_from(FairnessSmokeRunModel))

    assert quality_count >= 1
    assert feedback_count >= 1
    assert interpretation_count >= 1
    assert traces_count >= 1
    assert fairness_count >= 1
