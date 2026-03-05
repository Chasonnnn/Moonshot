from datetime import datetime, timedelta, timezone

from app.db.session import SessionLocal
from app.models.entities import JobRunModel
from app.services.store import store
from app.services.workers import touch_worker_heartbeat


def _create_generate_job(client, admin_headers) -> str:
    case = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "worker health",
            "scenario": "health checks",
            "artifacts": [],
            "metrics": [],
            "allowed_tools": [],
        },
    )
    assert case.status_code == 201
    case_id = case.json()["id"]
    submit = client.post(
        f"/v1/cases/{case_id}/generate",
        headers={**admin_headers, "Idempotency-Key": "worker-health-generate-1"},
    )
    assert submit.status_code == 202
    return submit.json()["job_id"]


def test_jobs_stale_leases_endpoint_returns_expired_running_jobs(client, admin_headers):
    job_id = _create_generate_job(client, admin_headers)

    with SessionLocal() as db:
        row = db.get(JobRunModel, job_id)
        assert row is not None
        row.status = "running"
        row.lease_owner = "worker-stale"
        row.lease_expires_at = datetime.now(timezone.utc) - timedelta(seconds=30)
        db.commit()

    response = client.get("/v1/jobs/stale-leases", headers=admin_headers)
    assert response.status_code == 200
    items = response.json()["items"]
    stale = [item for item in items if item["job_id"] == job_id]
    assert stale
    assert stale[0]["status"] == "running"
    assert stale[0]["lease_owner"] == "worker-stale"


def test_worker_health_endpoint_reports_overall_health(client, admin_headers):
    response = client.get("/v1/workers/health", headers=admin_headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["overall_status"] in {"ok", "degraded"}
    assert "workers" in payload
    assert "stale_leases" in payload


def test_worker_health_allows_historical_stale_rows_when_active_worker_exists(client, admin_headers):
    stale_time = datetime.now(timezone.utc) - timedelta(hours=1)
    store.worker_heartbeats["worker-old"] = {
        "worker_id": "worker-old",
        "last_seen_at": stale_time.isoformat(),
        "last_job_id": None,
    }
    touch_worker_heartbeat("worker-fresh")

    response = client.get("/v1/workers/health", headers=admin_headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["stale_leases"] == 0
    assert any(item["worker_id"] == "worker-fresh" and item["status"] == "ok" for item in payload["workers"])
    assert any(item["worker_id"] == "worker-old" and item["status"] == "stale" for item in payload["workers"])
    assert payload["overall_status"] == "ok"


def test_worker_health_ignores_expired_lease_owned_by_active_worker(client, admin_headers):
    job_id = _create_generate_job(client, admin_headers)
    owner = "worker-active"
    touch_worker_heartbeat(owner)

    with SessionLocal() as db:
        row = db.get(JobRunModel, job_id)
        assert row is not None
        row.status = "running"
        row.lease_owner = owner
        row.lease_expires_at = datetime.now(timezone.utc) - timedelta(seconds=30)
        db.commit()

    response = client.get("/v1/workers/health", headers=admin_headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["stale_leases"] == 0
    assert payload["overall_status"] == "ok"


def test_worker_health_ignores_expired_lease_owned_by_recent_worker(client, admin_headers):
    job_id = _create_generate_job(client, admin_headers)
    owner = "worker-recent"
    recent_time = datetime.now(timezone.utc) - timedelta(seconds=90)
    store.worker_heartbeats[owner] = {
        "worker_id": owner,
        "last_seen_at": recent_time.isoformat(),
        "last_job_id": None,
    }

    with SessionLocal() as db:
        row = db.get(JobRunModel, job_id)
        assert row is not None
        row.status = "running"
        row.lease_owner = owner
        row.lease_expires_at = datetime.now(timezone.utc) - timedelta(seconds=30)
        db.commit()

    response = client.get("/v1/workers/health", headers=admin_headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["stale_leases"] == 0
    assert payload["overall_status"] == "ok"
