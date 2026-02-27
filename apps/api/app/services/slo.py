from __future__ import annotations

from pathlib import Path
from time import perf_counter

from sqlalchemy import text

from app.db.session import SessionLocal
from app.schemas import SLOProbeResponse, SLOProbeResult
from app.services.audit_integrity import verify_audit_chain
from app.services.jobs import get_queue_runtime_metrics
from app.services.score_drift import run_benchmark_fixture
from app.services.store import store


def _probe_database() -> SLOProbeResult:
    started = perf_counter()
    with SessionLocal() as db:
        value = db.execute(text("SELECT 1")).scalar_one()
    latency_ms = max(1, int((perf_counter() - started) * 1000))
    return SLOProbeResult(status="ok", latency_ms=latency_ms, detail={"select_1": int(value)})


def _probe_audit_chain(tenant_id: str) -> SLOProbeResult:
    started = perf_counter()
    tenant_entries = [row for row in store.audit_logs if row.get("tenant_id") == tenant_id]
    result = verify_audit_chain(tenant_entries)
    latency_ms = max(1, int((perf_counter() - started) * 1000))
    status = "ok" if result.valid else "degraded"
    return SLOProbeResult(
        status=status,
        latency_ms=latency_ms,
        detail={
            "valid": result.valid,
            "checked_entries": result.checked_entries,
            "error_code": result.error_code,
            "error_detail": result.error_detail,
            "failed_index": result.failed_index,
        },
    )


def _probe_score_drift() -> SLOProbeResult:
    started = perf_counter()
    fixture_path = Path(__file__).resolve().parents[2] / "fixtures" / "scoring_benchmark.json"
    result = run_benchmark_fixture(fixture_path)
    latency_ms = max(1, int((perf_counter() - started) * 1000))
    status = "ok" if bool(result.get("pass")) else "degraded"
    return SLOProbeResult(
        status=status,
        latency_ms=latency_ms,
        detail={
            "pass": bool(result.get("pass")),
            "checked_cases": int(result.get("checked_cases", 0)),
            "drift_count": int(result.get("drift_count", 0)),
        },
    )


def _probe_queue_runtime(tenant_id: str) -> SLOProbeResult:
    started = perf_counter()
    metrics = get_queue_runtime_metrics(tenant_id)
    latency_ms = max(1, int((perf_counter() - started) * 1000))
    status = "ok" if metrics["queue_failed_permanent_count"] == 0 else "degraded"
    return SLOProbeResult(status=status, latency_ms=latency_ms, detail=metrics)


def run_slo_probes(tenant_id: str) -> SLOProbeResponse:
    probes = {
        "database": _probe_database(),
        "audit_chain": _probe_audit_chain(tenant_id),
        "score_drift": _probe_score_drift(),
        "queue_runtime": _probe_queue_runtime(tenant_id),
    }
    overall_status = "ok" if all(item.status == "ok" for item in probes.values()) else "degraded"
    return SLOProbeResponse(overall_status=overall_status, probes=probes)
