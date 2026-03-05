"""Tests for deliverable CRUD endpoints — TDD: written before implementation."""
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.services.jobs import process_jobs_until_empty
from app.services.store import store


def _job_result(client, job_id, headers):
    process_jobs_until_empty()
    response = client.get(f"/v1/jobs/{job_id}/result", headers=headers)
    assert response.status_code == 200
    return response.json()["result"]


def _setup_session(client: TestClient, admin_headers: dict) -> str:
    """Create a case + task family + session, return session_id."""
    case = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={"title": "Deliverable Test", "scenario": "Test scenario"},
    )
    assert case.status_code == 201
    case_id = case.json()["id"]

    gen = client.post(
        f"/v1/cases/{case_id}/generate",
        headers={**admin_headers, "Idempotency-Key": str(uuid4())},
    )
    assert gen.status_code == 202
    family_id = _job_result(client, gen.json()["job_id"], admin_headers)["task_family"]["id"]

    review = client.post(
        f"/v1/task-families/{family_id}/review",
        headers=admin_headers,
        json={"decision": "approve", "review_note": "ready"},
    )
    assert review.status_code == 200
    publish = client.post(
        f"/v1/task-families/{family_id}/publish",
        headers=admin_headers,
        json={},
    )
    assert publish.status_code == 200

    session = client.post(
        "/v1/sessions",
        headers=admin_headers,
        json={"task_family_id": family_id, "candidate_id": "candidate_1"},
    )
    assert session.status_code == 201
    return session.json()["id"]


def test_create_deliverable(client, admin_headers, candidate_headers):
    session_id = _setup_session(client, admin_headers)
    resp = client.post(
        f"/v1/sessions/{session_id}/deliverables",
        json={"content_markdown": "# My Report", "embedded_artifacts": []},
        headers=candidate_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["content_markdown"] == "# My Report"
    assert data["status"] == "draft"
    assert "id" in data


def test_get_deliverable(client, admin_headers, candidate_headers):
    session_id = _setup_session(client, admin_headers)
    create_resp = client.post(
        f"/v1/sessions/{session_id}/deliverables",
        json={"content_markdown": "# Draft"},
        headers=candidate_headers,
    )
    deliverable_id = create_resp.json()["id"]

    resp = client.get(
        f"/v1/sessions/{session_id}/deliverables/{deliverable_id}",
        headers=candidate_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["content_markdown"] == "# Draft"


def test_update_deliverable(client, admin_headers, candidate_headers):
    session_id = _setup_session(client, admin_headers)
    create_resp = client.post(
        f"/v1/sessions/{session_id}/deliverables",
        json={"content_markdown": "# V1"},
        headers=candidate_headers,
    )
    deliverable_id = create_resp.json()["id"]

    resp = client.put(
        f"/v1/sessions/{session_id}/deliverables/{deliverable_id}",
        json={"content_markdown": "# V2", "embedded_artifacts": ["art-1"]},
        headers=candidate_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["content_markdown"] == "# V2"
    assert resp.json()["embedded_artifacts"] == ["art-1"]


def test_submit_deliverable(client, admin_headers, candidate_headers):
    session_id = _setup_session(client, admin_headers)
    create_resp = client.post(
        f"/v1/sessions/{session_id}/deliverables",
        json={"content_markdown": "# Final"},
        headers=candidate_headers,
    )
    deliverable_id = create_resp.json()["id"]

    resp = client.post(
        f"/v1/sessions/{session_id}/deliverables/{deliverable_id}/submit",
        headers=candidate_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "submitted"

    # Cannot update after submit
    update_resp = client.put(
        f"/v1/sessions/{session_id}/deliverables/{deliverable_id}",
        json={"content_markdown": "# Changed"},
        headers=candidate_headers,
    )
    assert update_resp.status_code == 409


def test_list_deliverables(client, admin_headers, candidate_headers):
    session_id = _setup_session(client, admin_headers)
    client.post(
        f"/v1/sessions/{session_id}/deliverables",
        json={"content_markdown": "# A"},
        headers=candidate_headers,
    )
    client.post(
        f"/v1/sessions/{session_id}/deliverables",
        json={"content_markdown": "# B"},
        headers=candidate_headers,
    )

    resp = client.get(
        f"/v1/sessions/{session_id}/deliverables",
        headers=candidate_headers,
    )
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 2


def test_reviewer_can_read_deliverables(client, admin_headers, candidate_headers, reviewer_headers):
    session_id = _setup_session(client, admin_headers)
    client.post(
        f"/v1/sessions/{session_id}/deliverables",
        json={"content_markdown": "# Report"},
        headers=candidate_headers,
    )

    resp = client.get(
        f"/v1/sessions/{session_id}/deliverables",
        headers=reviewer_headers,
    )
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 1


def test_reviewer_cannot_create_deliverable(client, admin_headers, reviewer_headers):
    session_id = _setup_session(client, admin_headers)
    resp = client.post(
        f"/v1/sessions/{session_id}/deliverables",
        json={"content_markdown": "# Nope"},
        headers=reviewer_headers,
    )
    assert resp.status_code == 403


def test_deliverable_not_found(client, admin_headers, candidate_headers):
    session_id = _setup_session(client, admin_headers)
    resp = client.get(
        f"/v1/sessions/{session_id}/deliverables/{uuid4()}",
        headers=candidate_headers,
    )
    assert resp.status_code == 404
