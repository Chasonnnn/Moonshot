def test_slo_probes_requires_admin_role(client, candidate_headers):
    response = client.get("/v1/slo/probes", headers=candidate_headers)
    assert response.status_code == 403


def test_slo_probes_returns_probe_statuses(client, admin_headers):
    response = client.get("/v1/slo/probes", headers=admin_headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["overall_status"] in {"ok", "degraded"}
    assert "database" in payload["probes"]
    assert "audit_chain" in payload["probes"]
    assert "score_drift" in payload["probes"]
