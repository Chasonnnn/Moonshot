from __future__ import annotations

from datetime import datetime, timezone
from statistics import fmean
from uuid import UUID

from app.schemas import FairnessSmokeRun, FairnessSmokeRunCreate
from app.services.repositories import session_repository
from app.services.store import store


def _tenant_confidences(tenant_id: str) -> list[float]:
    values: list[float] = []
    for session_id, report_payload in store.reports.items():
        session = session_repository.get_session(UUID(str(session_id)))
        if session is None or session.tenant_id != tenant_id:
            continue
        score_result = report_payload.get("score_result", {})
        confidence = score_result.get("confidence")
        if isinstance(confidence, (int, float)):
            values.append(float(confidence))
    return values


def create_fairness_smoke_run(
    tenant_id: str,
    payload: FairnessSmokeRunCreate,
    *,
    created_by: str | None = None,
    submitted_job_id: UUID | None = None,
    request_id: str | None = None,
) -> FairnessSmokeRun:
    confidences = _tenant_confidences(tenant_id)
    sample_size = len(confidences)
    mean_confidence = round(fmean(confidences), 3) if confidences else 0.0

    summary = {
        "sample_size": sample_size,
        "group_metrics": {
            "overall": {
                "mean_confidence": mean_confidence,
                "below_review_threshold_rate": round(sum(1 for value in confidences if value < 0.7) / sample_size, 3)
                if sample_size
                else 0.0,
            },
            "language_proxy": {
                "enabled": payload.include_language_proxy,
                "delta_vs_overall": 0.0,
                "status": "smoke_only_not_decisioning",
            },
        },
        "alerts": [],
    }

    run = FairnessSmokeRun(
        tenant_id=tenant_id,
        scope=payload.scope,
        status="completed",
        created_by=created_by,
        submitted_job_id=submitted_job_id,
        request_id=request_id,
        target_session_id=payload.target_session_id,
        evidence_refs={
            "scope": payload.scope,
            "target_session_id": str(payload.target_session_id) if payload.target_session_id is not None else None,
            "sample_size": sample_size,
        },
        summary=summary,
        created_at=datetime.now(timezone.utc),
    )
    store.fairness_smoke_runs[run.id] = run.model_dump(mode="json")
    return run


def get_fairness_smoke_run(run_id: UUID) -> FairnessSmokeRun | None:
    payload = store.fairness_smoke_runs.get(run_id)
    if payload is None:
        return None
    return FairnessSmokeRun.model_validate(payload)


def list_fairness_smoke_runs_for_tenant(
    tenant_id: str,
    *,
    scope: str | None = None,
    status: str | None = None,
    target_session_id: UUID | None = None,
    limit: int = 20,
) -> list[FairnessSmokeRun]:
    target_session_id_str = str(target_session_id) if target_session_id is not None else None
    bounded_limit = min(max(limit, 1), 100)
    items: list[FairnessSmokeRun] = []
    for payload in store.fairness_smoke_runs.values():
        run = FairnessSmokeRun.model_validate(payload)
        if run.tenant_id != tenant_id:
            continue
        if scope is not None and run.scope != scope:
            continue
        if status is not None and run.status != status:
            continue
        if target_session_id_str is not None and str(run.target_session_id) != target_session_id_str:
            continue
        items.append(run)
    items.sort(key=lambda item: item.created_at, reverse=True)
    return items[:bounded_limit]
