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
    assert "queue_runtime" in payload["probes"]

    queue_detail = payload["probes"]["queue_runtime"]["detail"]
    assert "queue_backlog_count" in queue_detail
    assert "queue_oldest_pending_age_seconds" in queue_detail
    assert "queue_retrying_count" in queue_detail
    assert "queue_failed_permanent_count" in queue_detail
    assert "queue_inflight_leased_count" in queue_detail
