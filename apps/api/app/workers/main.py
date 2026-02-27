from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.core.config import get_settings
from app.services.jobs import process_jobs_once
from app.services.workers import touch_worker_heartbeat


def run_worker(once: bool = False) -> int:
    settings = get_settings()
    worker_id = f"worker-{uuid4().hex[:8]}"
    processed = 0
    heartbeat_interval = max(0.5, float(settings.worker_heartbeat_interval_seconds))
    next_heartbeat = datetime.now(timezone.utc)

    while True:
        did_work = process_jobs_once(worker_id=worker_id)
        if did_work:
            processed += 1
            if datetime.now(timezone.utc) >= next_heartbeat:
                touch_worker_heartbeat(worker_id, last_job_id="processed")
                next_heartbeat = datetime.now(timezone.utc) + timedelta(seconds=heartbeat_interval)
            continue

        if once:
            touch_worker_heartbeat(worker_id)
            return processed

        if datetime.now(timezone.utc) >= next_heartbeat:
            touch_worker_heartbeat(worker_id)
            next_heartbeat = datetime.now(timezone.utc) + timedelta(seconds=heartbeat_interval)
        time.sleep(settings.worker_poll_interval_seconds)


if __name__ == "__main__":
    run_worker(once=False)
