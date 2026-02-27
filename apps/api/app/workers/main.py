from __future__ import annotations

import time
from uuid import uuid4

from app.core.config import get_settings
from app.services.jobs import process_jobs_once


def run_worker(once: bool = False) -> int:
    settings = get_settings()
    worker_id = f"worker-{uuid4().hex[:8]}"
    processed = 0

    while True:
        did_work = process_jobs_once(worker_id=worker_id)
        if did_work:
            processed += 1
            continue

        if once:
            return processed

        time.sleep(settings.worker_poll_interval_seconds)


if __name__ == "__main__":
    run_worker(once=False)
