def test_missing_idempotency_returns_machine_readable_error(client, admin_headers):
    created = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "Error envelope case",
            "scenario": "missing idempotency",
            "artifacts": [],
            "metrics": [],
            "allowed_tools": [],
        },
    )
    assert created.status_code == 201
    case_id = created.json()["id"]

    response = client.post(f"/v1/cases/{case_id}/generate", headers=admin_headers)
    assert response.status_code == 400
    payload = response.json()
    assert payload["error_code"] == "missing_idempotency_key"
    assert payload["error_detail"] == "Missing Idempotency-Key header"
    assert isinstance(payload["request_id"], str) and payload["request_id"]
    assert payload["detail"] == "Missing Idempotency-Key header"


def test_not_ready_job_result_returns_machine_readable_error(client, admin_headers):
    created = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "Pending result",
            "scenario": "pending",
            "artifacts": [],
            "metrics": [],
            "allowed_tools": [],
        },
    )
    assert created.status_code == 201
    case_id = created.json()["id"]
    submit = client.post(
        f"/v1/cases/{case_id}/generate",
        headers={**admin_headers, "Idempotency-Key": "pending-machine-error"},
    )
    assert submit.status_code == 202

    result = client.get(f"/v1/jobs/{submit.json()['job_id']}/result", headers=admin_headers)
    assert result.status_code == 200
    payload = result.json()["result"]
    assert payload["error_code"] == "job_not_ready"
    assert payload["error_detail"] == "Job result not available yet"
