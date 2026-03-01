from app.core.security import issue_access_token
from app.services.jobs import process_jobs_until_empty


def _job_result(client, job_id, headers):
    process_jobs_until_empty()
    response = client.get(f"/v1/jobs/{job_id}/result", headers=headers)
    assert response.status_code == 200
    return response.json()


def test_fairness_run_list_and_get_scoped_to_tenant(client, admin_headers, reviewer_headers):
    submit = client.post(
        "/v1/fairness/smoke-runs",
        headers={**admin_headers, "Idempotency-Key": "fairness-read-1"},
        json={"scope": "tenant_recent", "include_language_proxy": True},
    )
    assert submit.status_code == 202
    result = _job_result(client, submit.json()["job_id"], admin_headers)
    assert result["status"] == "completed"
    run_id = result["result"]["id"]

    list_resp = client.get("/v1/fairness/smoke-runs", headers=reviewer_headers)
    assert list_resp.status_code == 200
    items = list_resp.json()["items"]
    listed_ids = {item["id"] for item in items}
    assert run_id in listed_ids
    listed = next(item for item in items if item["id"] == run_id)
    assert listed["created_by"] == "admin_1"
    assert listed["submitted_job_id"] == submit.json()["job_id"]
    assert listed["request_id"] is not None
    assert listed["created_at"] is not None
    assert listed["evidence_refs"]["scope"] == "tenant_recent"

    get_resp = client.get(f"/v1/fairness/smoke-runs/{run_id}", headers=reviewer_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == run_id
    assert get_resp.json()["created_by"] == "admin_1"
    assert get_resp.json()["submitted_job_id"] == submit.json()["job_id"]
    assert get_resp.json()["request_id"] is not None

    other_tenant_headers = {
        "Authorization": f"Bearer {issue_access_token(role='reviewer', user_id='reviewer_other', tenant_id='tenant_b').access_token}"
    }
    forbidden_get = client.get(f"/v1/fairness/smoke-runs/{run_id}", headers=other_tenant_headers)
    assert forbidden_get.status_code == 404

    other_list = client.get("/v1/fairness/smoke-runs", headers=other_tenant_headers)
    assert other_list.status_code == 200
    assert all(item["id"] != run_id for item in other_list.json()["items"])


def test_fairness_run_list_supports_filters_and_limit(client, admin_headers):
    for idx in range(3):
        submit = client.post(
            "/v1/fairness/smoke-runs",
            headers={**admin_headers, "Idempotency-Key": f"fairness-filter-{idx}"},
            json={"scope": "tenant_recent" if idx < 2 else "tenant_all", "include_language_proxy": idx % 2 == 0},
        )
        assert submit.status_code == 202
        _job_result(client, submit.json()["job_id"], admin_headers)

    filtered = client.get(
        "/v1/fairness/smoke-runs?scope=tenant_recent&status=completed&limit=1",
        headers=admin_headers,
    )
    assert filtered.status_code == 200
    items = filtered.json()["items"]
    assert len(items) == 1
    assert items[0]["scope"] == "tenant_recent"
    assert items[0]["status"] == "completed"
