from uuid import uuid4

from app.core.security import issue_access_token
from app.services.jobs import process_jobs_until_empty


def _job_result(client, job_id, headers):
    process_jobs_until_empty()
    response = client.get(f"/v1/jobs/{job_id}/result", headers=headers)
    assert response.status_code == 200
    return response.json()


def test_redteam_run_list_and_get_scoped_to_tenant(client, admin_headers):
    submit = client.post(
        "/v1/redteam/runs",
        headers={**admin_headers, "Idempotency-Key": "redteam-read-1"},
        json={"target_type": "session", "target_id": str(uuid4())},
    )
    assert submit.status_code == 202
    result = _job_result(client, submit.json()["job_id"], admin_headers)
    assert result["status"] == "completed"
    run_id = result["result"]["id"]

    list_resp = client.get("/v1/redteam/runs", headers=admin_headers)
    assert list_resp.status_code == 200
    listed_ids = {item["id"] for item in list_resp.json()["items"]}
    assert run_id in listed_ids

    get_resp = client.get(f"/v1/redteam/runs/{run_id}", headers=admin_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == run_id

    other_tenant_headers = {
        "Authorization": f"Bearer {issue_access_token(role='org_admin', user_id='admin_other', tenant_id='tenant_b').access_token}"
    }
    forbidden_get = client.get(f"/v1/redteam/runs/{run_id}", headers=other_tenant_headers)
    assert forbidden_get.status_code == 404

    other_list = client.get("/v1/redteam/runs", headers=other_tenant_headers)
    assert other_list.status_code == 200
    assert all(item["id"] != run_id for item in other_list.json()["items"])


def test_redteam_run_list_supports_target_filters(client, admin_headers):
    session_target = str(uuid4())
    case_target = str(uuid4())

    submit_session = client.post(
        "/v1/redteam/runs",
        headers={**admin_headers, "Idempotency-Key": "redteam-filter-session"},
        json={"target_type": "session", "target_id": session_target},
    )
    assert submit_session.status_code == 202
    _job_result(client, submit_session.json()["job_id"], admin_headers)

    submit_case = client.post(
        "/v1/redteam/runs",
        headers={**admin_headers, "Idempotency-Key": "redteam-filter-case"},
        json={"target_type": "case", "target_id": case_target},
    )
    assert submit_case.status_code == 202
    _job_result(client, submit_case.json()["job_id"], admin_headers)

    filtered = client.get(
        f"/v1/redteam/runs?target_type=session&target_id={session_target}",
        headers=admin_headers,
    )
    assert filtered.status_code == 200
    items = filtered.json()["items"]
    assert len(items) == 1
    assert items[0]["target_type"] == "session"
    assert items[0]["target_id"] == session_target
