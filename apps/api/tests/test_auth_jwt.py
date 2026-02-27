from app.core.security import issue_access_token


def test_protected_endpoint_requires_bearer_token(client):
    response = client.get("/v1/cases")
    assert response.status_code == 401


def test_header_spoof_without_bearer_is_rejected(client):
    response = client.get(
        "/v1/cases",
        headers={"X-Role": "org_admin", "X-User-Id": "admin_1", "X-Tenant-Id": "tenant_a"},
    )
    assert response.status_code == 401


def test_bootstrap_token_endpoint_issues_valid_token(client):
    response = client.post(
        "/v1/auth/token",
        headers={"X-Bootstrap-Token": "moonshot-bootstrap-dev"},
        json={"role": "reviewer", "user_id": "reviewer_1", "tenant_id": "tenant_a", "expires_in_seconds": 3600},
    )
    assert response.status_code == 201
    payload = response.json()
    assert payload["token_type"] == "bearer"
    assert payload["access_token"]

    authorized = client.get(
        "/v1/cases",
        headers={"Authorization": f"Bearer {payload['access_token']}"},
    )
    assert authorized.status_code == 200


def test_invalid_bearer_token_is_rejected(client):
    response = client.get("/v1/cases", headers={"Authorization": "Bearer not-a-valid-token"})
    assert response.status_code == 401


def test_expired_token_is_rejected(client):
    expired = issue_access_token(role="org_admin", user_id="admin_1", tenant_id="tenant_a", expires_in_seconds=-5)
    response = client.get("/v1/cases", headers={"Authorization": f"Bearer {expired.access_token}"})
    assert response.status_code == 401


def test_tenant_claim_mismatch_returns_not_found(client):
    token = issue_access_token(role="org_admin", user_id="admin_1", tenant_id="tenant_a").access_token
    other_tenant_token = issue_access_token(role="reviewer", user_id="reviewer_1", tenant_id="tenant_b").access_token

    created = client.post(
        "/v1/cases",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "Tenant Case",
            "scenario": "Tenant isolation check",
            "artifacts": [],
            "metrics": [],
            "allowed_tools": [],
        },
    )
    assert created.status_code == 201
    case_id = created.json()["id"]

    fetch = client.get(
        f"/v1/cases/{case_id}",
        headers={"Authorization": f"Bearer {other_tenant_token}"},
    )
    assert fetch.status_code == 404
