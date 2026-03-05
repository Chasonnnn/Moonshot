"""Tests for dataset listing endpoint — TDD: written before implementation."""
from uuid import uuid4

from app.services.jobs import process_jobs_until_empty


def _job_result(client, job_id, headers):
    process_jobs_until_empty()
    response = client.get(f"/v1/jobs/{job_id}/result", headers=headers)
    assert response.status_code == 200
    return response.json()["result"]


def _create_session(client, admin_headers, template_id="tpl_doordash_enablement"):
    case = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={"title": "Dataset Test", "scenario": "Test scenario"},
    )
    case_id = case.json()["id"]
    gen = client.post(
        f"/v1/cases/{case_id}/generate",
        headers={**admin_headers, "Idempotency-Key": str(uuid4())},
        json={"mode": "fixture", "template_id": template_id},
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
        f"/v1/task-families/{family_id}/publish", headers=admin_headers, json={},
    )
    assert publish.status_code == 200
    session = client.post(
        "/v1/sessions",
        headers=admin_headers,
        json={"task_family_id": family_id, "candidate_id": "candidate_1"},
    )
    assert session.status_code == 201
    return session.json()["id"]


def test_list_datasets_for_doordash_session(client, admin_headers, candidate_headers):
    session_id = _create_session(client, admin_headers, "tpl_doordash_enablement")
    resp = client.get(
        f"/v1/sessions/{session_id}/datasets",
        headers=candidate_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "datasets" in data
    assert len(data["datasets"]) >= 1
    ds = data["datasets"][0]
    assert ds["name"] == "doordash_restaurant_data"
    assert ds["row_count"] == 100
    assert len(ds["columns"]) == 25


def test_list_datasets_returns_empty_for_default_template(client, admin_headers, candidate_headers):
    session_id = _create_session(client, admin_headers, "tpl_data_analyst")
    resp = client.get(
        f"/v1/sessions/{session_id}/datasets",
        headers=candidate_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["datasets"] == []


def test_dataset_preview_returns_rows(client, admin_headers, candidate_headers):
    session_id = _create_session(client, admin_headers, "tpl_doordash_enablement")
    resp = client.get(
        f"/v1/sessions/{session_id}/datasets/doordash_restaurant_data/preview",
        headers=candidate_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["rows"]) <= 20
    assert len(data["rows"]) > 0
    assert "columns" in data


def test_dataset_preview_not_found(client, admin_headers, candidate_headers):
    session_id = _create_session(client, admin_headers, "tpl_doordash_enablement")
    resp = client.get(
        f"/v1/sessions/{session_id}/datasets/nonexistent_dataset/preview",
        headers=candidate_headers,
    )
    assert resp.status_code == 404
