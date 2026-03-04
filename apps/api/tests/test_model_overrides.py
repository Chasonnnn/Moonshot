from uuid import uuid4

from app.schemas import CoachResponse, JobAccepted, Session


def test_generate_request_passes_model_override_fields_to_job_payload(client, admin_headers, monkeypatch):
    captured: dict = {}

    def _fake_submit_job(**kwargs):
        captured.update(kwargs)
        return JobAccepted(job_id=uuid4(), status="pending")

    monkeypatch.setattr("app.api.v1.endpoints.cases.submit_job", _fake_submit_job)

    case = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "Override Case",
            "scenario": "Investigate anomaly.",
            "artifacts": [],
            "metrics": [],
            "allowed_tools": [],
        },
    )
    assert case.status_code == 201
    case_id = case.json()["id"]

    response = client.post(
        f"/v1/cases/{case_id}/generate",
        headers={**admin_headers, "Idempotency-Key": "override-gen-1"},
        json={
            "mode": "live",
            "model_override": "gemini/gemini-3.1-pro-preview",
            "reasoning_effort": "high",
            "thinking_budget_tokens": 2048,
        },
    )
    assert response.status_code == 202
    assert captured["request_payload"]["model_override"] == "gemini/gemini-3.1-pro-preview"
    assert captured["request_payload"]["reasoning_effort"] == "high"
    assert captured["request_payload"]["thinking_budget_tokens"] == 2048


def test_score_request_passes_model_override_fields_to_job_payload(client, reviewer_headers, monkeypatch):
    session_id = uuid4()
    fake_session = Session(
        id=session_id,
        tenant_id="tenant_a",
        task_family_id=uuid4(),
        candidate_id="candidate_1",
        status="submitted",
        policy={},
    )
    captured: dict = {}

    def _fake_submit_job(**kwargs):
        captured.update(kwargs)
        return JobAccepted(job_id=uuid4(), status="pending")

    monkeypatch.setattr("app.api.v1.endpoints.scoring.session_repository.get_session", lambda _session_id: fake_session)
    monkeypatch.setattr("app.api.v1.endpoints.scoring.submit_job", _fake_submit_job)

    response = client.post(
        f"/v1/sessions/{session_id}/score",
        headers={**reviewer_headers, "Idempotency-Key": "override-score-1"},
        json={
            "mode": "live",
            "model_override": "anthropic/claude-opus-4-6",
            "reasoning_effort": "high",
            "thinking_budget_tokens": 4096,
        },
    )
    assert response.status_code == 202
    assert captured["request_payload"]["model_override"] == "anthropic/claude-opus-4-6"
    assert captured["request_payload"]["reasoning_effort"] == "high"
    assert captured["request_payload"]["thinking_budget_tokens"] == 4096


def test_coach_request_passes_model_override_fields_to_coach_service(client, candidate_headers, monkeypatch):
    session_id = uuid4()
    fake_session = Session(
        id=session_id,
        tenant_id="tenant_a",
        task_family_id=uuid4(),
        candidate_id="candidate_1",
        status="active",
        policy={"coach_mode": "assessment"},
    )
    captured: dict = {}

    def _fake_coach_reply(
        message: str,
        session_context: str,
        *,
        mode: str,
        model_override: str | None,
        reasoning_effort: str | None,
        thinking_budget_tokens: int | None,
    ) -> CoachResponse:
        captured.update(
            {
                "message": message,
                "session_context": session_context,
                "mode": mode,
                "model_override": model_override,
                "reasoning_effort": reasoning_effort,
                "thinking_budget_tokens": thinking_budget_tokens,
            }
        )
        return CoachResponse(
            allowed=True,
            response="use constraints and validate assumptions",
            policy_reason="context_only_allowed",
            policy_decision_code="allowed_context_only",
            policy_version="0.3.0",
            policy_hash="f" * 64,
            blocked_rule_id=None,
        )

    monkeypatch.setattr("app.api.v1.endpoints.coach.session_repository.get_session", lambda _session_id: fake_session)
    monkeypatch.setattr("app.api.v1.endpoints.coach.case_repository.get_task_family", lambda _task_family_id: None)
    monkeypatch.setattr("app.api.v1.endpoints.coach.coach_reply", _fake_coach_reply)

    response = client.post(
        f"/v1/sessions/{session_id}/coach/message",
        headers=candidate_headers,
        json={
            "message": "How should I validate this quickly?",
            "model_override": "chatgpt/gpt-5.2",
            "reasoning_effort": "high",
            "thinking_budget_tokens": None,
        },
    )
    assert response.status_code == 200
    assert captured["mode"] == "assessment"
    assert captured["model_override"] == "chatgpt/gpt-5.2"
    assert captured["reasoning_effort"] == "high"
    assert captured["thinking_budget_tokens"] is None
