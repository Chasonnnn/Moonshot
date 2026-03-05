from __future__ import annotations

from datetime import datetime, timezone

from app.core.config import get_settings
from app.schemas import WorkerHealthResponse, WorkerStatus
from app.services.jobs import get_stale_leases_for_tenant
from app.services.store import store


def _now() -> datetime:
    return datetime.now(timezone.utc)


def touch_worker_heartbeat(worker_id: str, *, last_job_id: str | None = None) -> None:
    now = _now()
    payload = {
        "worker_id": worker_id,
        "last_seen_at": now.isoformat(),
        "last_job_id": last_job_id,
    }
    store.worker_heartbeats[worker_id] = payload


def get_worker_health(tenant_id: str) -> WorkerHealthResponse:
    now = _now()
    stale_after_seconds = int(get_settings().worker_stale_after_seconds)
    worker_rows = sorted(store.worker_heartbeats.values(), key=lambda row: str(row.get("worker_id")))

    workers: list[WorkerStatus] = []
    for row in worker_rows:
        raw_last_seen = row.get("last_seen_at")
        if isinstance(raw_last_seen, str):
            last_seen_at = datetime.fromisoformat(raw_last_seen)
        elif isinstance(raw_last_seen, datetime):
            last_seen_at = raw_last_seen
        else:
            continue

        if last_seen_at.tzinfo is None:
            last_seen_at = last_seen_at.replace(tzinfo=timezone.utc)

        age_seconds = max(0, int((now - last_seen_at).total_seconds()))
        status = "ok" if age_seconds <= stale_after_seconds else "stale"
        workers.append(
            WorkerStatus(
                worker_id=str(row.get("worker_id")),
                last_seen_at=last_seen_at,
                seconds_since_last_seen=age_seconds,
                status=status,
                last_job_id=str(row.get("last_job_id")) if row.get("last_job_id") else None,
            )
        )

    stale_leases = len(get_stale_leases_for_tenant(tenant_id, limit=500))
    has_active_worker = any(item.status == "ok" for item in workers)
    overall_status = "ok" if stale_leases == 0 and has_active_worker else "degraded"
    return WorkerHealthResponse(overall_status=overall_status, workers=workers, stale_leases=stale_leases, checked_at=now)
