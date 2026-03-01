from __future__ import annotations

from uuid import UUID

from app.schemas import RedTeamRun
from app.services.store import store


def run_redteam(target_type: str, target_id) -> RedTeamRun:
    findings = [
        {
            "id": "RT-001",
            "severity": "medium",
            "title": "Direct-answer prompt attempt",
            "status": "mitigated",
            "notes": "Coach policy blocks explicit answer requests.",
        },
        {
            "id": "RT-002",
            "severity": "low",
            "title": "Variant similarity drift",
            "status": "open",
            "notes": "Increase lexical and structural divergence in generator templates.",
        },
    ]
    return RedTeamRun(target_type=target_type, target_id=target_id, status="completed", findings=findings)


def _tenant_for_run(run_id: UUID) -> str | None:
    run_key = str(run_id)
    for row in store.audit_logs:
        if row.get("resource_type") != "redteam":
            continue
        if row.get("resource_id") != run_key:
            continue
        tenant_id = row.get("tenant_id")
        if isinstance(tenant_id, str):
            return tenant_id
    return None


def list_redteam_runs_for_tenant(
    tenant_id: str,
    *,
    target_type: str | None = None,
    target_id: UUID | None = None,
) -> list[RedTeamRun]:
    target_id_str = str(target_id) if target_id is not None else None
    items: list[RedTeamRun] = []
    for run_id, payload in store.redteam_runs.items():
        if _tenant_for_run(run_id) != tenant_id:
            continue
        run = RedTeamRun.model_validate(payload)
        if target_type is not None and run.target_type != target_type:
            continue
        if target_id_str is not None and str(run.target_id) != target_id_str:
            continue
        items.append(run)
    items.sort(key=lambda item: str(item.id), reverse=True)
    return items


def get_redteam_run_for_tenant(tenant_id: str, run_id: UUID) -> RedTeamRun | None:
    payload = store.redteam_runs.get(run_id)
    if payload is None:
        return None
    if _tenant_for_run(run_id) != tenant_id:
        return None
    return RedTeamRun.model_validate(payload)
