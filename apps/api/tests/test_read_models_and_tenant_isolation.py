from uuid import UUID


def _bootstrap_resources(client, admin_headers, reviewer_headers):
    pack = client.post(
        "/v1/business-context/packs",
        headers=admin_headers,
        json={
            "name": "JDA Pack",
            "role_focus": "junior_data_analyst",
            "job_description": "Analyze growth funnel anomalies.",
            "examples": ["Investigate conversion drop by region."],
            "constraints": {"timebox_minutes": 45},
        },
    )
    assert pack.status_code == 201
    pack_id = pack.json()["id"]

    case = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "context_pack_id": pack_id,
            "title": "Weekly Funnel Drop",
            "scenario": "Activation conversion dropped 15% WoW.",
            "artifacts": [{"type": "csv", "name": "funnel.csv"}],
            "metrics": [],
            "allowed_tools": ["sql_workspace", "dashboard_workspace"],
        },
    )
    assert case.status_code == 201
    case_id = case.json()["id"]

    generated = client.post(f"/v1/cases/{case_id}/generate", headers=admin_headers)
    assert generated.status_code == 200
    task_family_id = generated.json()["task_family"]["id"]

    published = client.post(f"/v1/task-families/{task_family_id}/publish", headers=reviewer_headers, json={})
    assert published.status_code == 200

    session = client.post(
        "/v1/sessions",
        headers=reviewer_headers,
        json={
            "task_family_id": task_family_id,
            "candidate_id": "candidate_1",
            "policy": {"raw_content_opt_in": False, "retention_ttl_days": 30},
        },
    )
    assert session.status_code == 201
    session_id = session.json()["id"]

    return {
        "pack_id": pack_id,
        "case_id": case_id,
        "task_family_id": task_family_id,
        "session_id": session_id,
    }


def test_get_and_list_endpoints_for_frontend_bootstrap(client, admin_headers, reviewer_headers):
    ids = _bootstrap_resources(client, admin_headers, reviewer_headers)

    packs = client.get("/v1/business-context/packs", headers=reviewer_headers)
    assert packs.status_code == 200
    assert any(item["id"] == ids["pack_id"] for item in packs.json()["items"])

    pack = client.get(f"/v1/business-context/packs/{ids['pack_id']}", headers=reviewer_headers)
    assert pack.status_code == 200
    assert pack.json()["name"] == "JDA Pack"

    cases = client.get("/v1/cases", headers=reviewer_headers)
    assert cases.status_code == 200
    assert any(item["id"] == ids["case_id"] for item in cases.json()["items"])

    case = client.get(f"/v1/cases/{ids['case_id']}", headers=reviewer_headers)
    assert case.status_code == 200
    assert case.json()["title"] == "Weekly Funnel Drop"

    families = client.get("/v1/task-families", headers=reviewer_headers)
    assert families.status_code == 200
    assert any(item["id"] == ids["task_family_id"] for item in families.json()["items"])

    family = client.get(f"/v1/task-families/{ids['task_family_id']}", headers=reviewer_headers)
    assert family.status_code == 200
    assert family.json()["status"] == "published"

    sessions = client.get("/v1/sessions", headers=reviewer_headers)
    assert sessions.status_code == 200
    assert any(item["id"] == ids["session_id"] for item in sessions.json()["items"])

    session = client.get(f"/v1/sessions/{ids['session_id']}", headers=reviewer_headers)
    assert session.status_code == 200
    assert session.json()["candidate_id"] == "candidate_1"


def test_cross_tenant_reads_and_mutations_are_blocked(client, admin_headers, reviewer_headers):
    ids = _bootstrap_resources(client, admin_headers, reviewer_headers)
    tenant_b_admin = {**admin_headers, "X-Tenant-Id": "tenant_b", "X-User-Id": "admin_b"}
    tenant_b_reviewer = {**reviewer_headers, "X-Tenant-Id": "tenant_b", "X-User-Id": "reviewer_b"}

    case_patch = client.patch(
        f"/v1/cases/{ids['case_id']}",
        headers=tenant_b_admin,
        json={"title": "Hacked title"},
    )
    assert case_patch.status_code == 404

    case_get = client.get(f"/v1/cases/{ids['case_id']}", headers=tenant_b_reviewer)
    assert case_get.status_code == 404

    family_publish = client.post(f"/v1/task-families/{ids['task_family_id']}/publish", headers=tenant_b_reviewer, json={})
    assert family_publish.status_code == 404

    session_get = client.get(f"/v1/sessions/{ids['session_id']}", headers=tenant_b_reviewer)
    assert session_get.status_code == 404

    score = client.post(f"/v1/sessions/{ids['session_id']}/score", headers=tenant_b_reviewer)
    assert score.status_code == 404


def test_candidate_can_only_get_own_session(client, admin_headers, reviewer_headers, candidate_headers):
    ids = _bootstrap_resources(client, admin_headers, reviewer_headers)
    own = client.get(f"/v1/sessions/{ids['session_id']}", headers=candidate_headers)
    assert own.status_code == 200

    other_candidate_headers = {
        **candidate_headers,
        "X-User-Id": "candidate_other",
    }
    other = client.get(f"/v1/sessions/{ids['session_id']}", headers=other_candidate_headers)
    assert other.status_code == 404
