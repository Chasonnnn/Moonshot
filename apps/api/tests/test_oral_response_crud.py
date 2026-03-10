from uuid import uuid4

from app.schemas import Session
from app.services.repositories import session_repository
from app.services.jobs import process_jobs_until_empty


def _job_result(client, job_id, headers):
    process_jobs_until_empty()
    response = client.get(f"/v1/jobs/{job_id}/result", headers=headers)
    assert response.status_code == 200
    return response.json()


def _setup_session(client, admin_headers, reviewer_headers, *, raw_content_opt_in: bool = False, oral_required: bool = False):
    case = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={"title": "Oral Response Test", "scenario": "Present your findings."},
    )
    assert case.status_code == 201
    case_id = case.json()["id"]

    gen = client.post(
        f"/v1/cases/{case_id}/generate",
        headers={**admin_headers, "Idempotency-Key": str(uuid4())},
    )
    assert gen.status_code == 202
    family_id = _job_result(client, gen.json()["job_id"], admin_headers)["result"]["task_family"]["id"]

    review = client.post(
        f"/v1/task-families/{family_id}/review",
        headers=reviewer_headers,
        json={"decision": "approve", "review_note": "ready"},
    )
    assert review.status_code == 200
    publish = client.post(
        f"/v1/task-families/{family_id}/publish",
        headers=reviewer_headers,
        json={},
    )
    assert publish.status_code == 200

    session = client.post(
        "/v1/sessions",
        headers=reviewer_headers,
        json={
            "task_family_id": family_id,
            "candidate_id": "candidate_1",
            "policy": {
                "raw_content_opt_in": raw_content_opt_in,
                "oral_defense_required": oral_required,
                "oral_required_clip_types": ["presentation", "follow_up_1", "follow_up_2"] if oral_required else [],
            },
        },
    )
    assert session.status_code == 201
    return session.json()["id"]


def test_create_and_list_oral_responses_records_transcript_and_events(
    client, admin_headers, reviewer_headers, candidate_headers, monkeypatch
):
    def fake_transcribe_oral_response(*args, **kwargs):
        return {
            "transcript_text": "The paid social drop is isolated to signup-to-activation.",
            "transcription_model": "gpt-4o-transcribe",
            "request_id": "req-oral-1",
        }

    monkeypatch.setattr("app.services.oral_responses.transcribe_oral_response", fake_transcribe_oral_response)

    session_id = _setup_session(client, admin_headers, reviewer_headers, raw_content_opt_in=False)
    response = client.post(
        f"/v1/sessions/{session_id}/oral-responses",
        headers=candidate_headers,
        data={"clip_type": "presentation", "duration_ms": "45000"},
        files={"file": ("presentation.webm", b"fake-webm-audio", "audio/webm")},
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["clip_type"] == "presentation"
    assert payload["duration_ms"] == 45000
    assert payload["mime_type"] == "audio/webm"
    assert payload["status"] == "transcribed"
    assert payload["transcript_text"].startswith("The paid social drop")
    assert payload["transcription_model"] == "gpt-4o-transcribe"
    assert payload["request_id"] == "req-oral-1"
    assert payload["audio_retained"] is False

    listed = client.get(f"/v1/sessions/{session_id}/oral-responses", headers=reviewer_headers)
    assert listed.status_code == 200
    assert len(listed.json()["items"]) == 1
    assert listed.json()["items"][0]["id"] == payload["id"]

    events = client.get(f"/v1/sessions/{session_id}/events", headers=candidate_headers)
    assert events.status_code == 200
    event_types = [item["event_type"] for item in events.json()["items"]]
    assert "oral_response_uploaded" in event_types
    assert "oral_response_transcribed" in event_types


def test_oral_response_retains_audio_only_when_raw_content_is_opted_in(
    client, admin_headers, reviewer_headers, candidate_headers, monkeypatch
):
    def fake_transcribe_oral_response(*args, **kwargs):
        return {
            "transcript_text": "We should pause paid social and validate audience drift.",
            "transcription_model": "gpt-4o-transcribe",
            "request_id": "req-oral-2",
        }

    monkeypatch.setattr("app.services.oral_responses.transcribe_oral_response", fake_transcribe_oral_response)

    session_id = _setup_session(client, admin_headers, reviewer_headers, raw_content_opt_in=True)
    response = client.post(
        f"/v1/sessions/{session_id}/oral-responses",
        headers=candidate_headers,
        data={"clip_type": "follow_up_1", "question_id": "q-1", "duration_ms": "30000"},
        files={"file": ("answer.webm", b"fake-answer-audio", "audio/webm")},
    )

    assert response.status_code == 201
    assert response.json()["audio_retained"] is True


def test_submit_blocks_when_required_oral_responses_are_missing(
    client, admin_headers, reviewer_headers, candidate_headers
):
    session_id = _setup_session(client, admin_headers, reviewer_headers, oral_required=True)

    submit = client.post(
        f"/v1/sessions/{session_id}/submit",
        headers=candidate_headers,
        json={"final_response": "I would pause the campaign and validate audience quality."},
    )
    assert submit.status_code == 409
    assert "oral_response_missing" in submit.json()["detail"]


def test_score_blocks_when_required_oral_responses_are_missing(
    client, admin_headers, reviewer_headers, candidate_headers
):
    session_id = _setup_session(client, admin_headers, reviewer_headers, oral_required=True)
    existing = session_repository.get_session(session_id)
    assert existing is not None
    session_repository.save_session(
        Session.model_validate(
            {
                **existing.model_dump(mode="json"),
                "status": "submitted",
            }
        )
    )

    score = client.post(
        f"/v1/sessions/{session_id}/score",
        headers={**reviewer_headers, "Idempotency-Key": "oral-required-score-1"},
    )
    assert score.status_code == 409
    assert "oral_response_missing" in score.json()["detail"]
