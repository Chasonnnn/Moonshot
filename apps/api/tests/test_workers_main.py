import time
from types import SimpleNamespace

from app.workers import main as workers_main


def test_run_worker_emits_heartbeat_during_blocking_job(monkeypatch):
    touches: list[tuple[float, str | None]] = []

    def fake_touch_worker_heartbeat(worker_id: str, last_job_id: str | None = None) -> None:
        touches.append((time.monotonic(), last_job_id))

    def fake_process_jobs_once(*, worker_id: str) -> bool:
        # Simulate a blocking network/model call inside a single job attempt.
        time.sleep(1.2)
        return False

    settings = SimpleNamespace(
        worker_heartbeat_interval_seconds=0.5,
        worker_poll_interval_seconds=0.01,
    )

    monkeypatch.setattr(workers_main, "get_settings", lambda: settings)
    monkeypatch.setattr(workers_main, "touch_worker_heartbeat", fake_touch_worker_heartbeat)
    monkeypatch.setattr(workers_main, "process_jobs_once", fake_process_jobs_once)

    processed = workers_main.run_worker(once=True)

    assert processed == 0
    # Initial + background heartbeat(s) + once-return heartbeat.
    assert len(touches) >= 3
