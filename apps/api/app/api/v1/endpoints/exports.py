from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import ExportBundle, Report
from app.services.audit import audit
from app.services.exporting import build_export
from app.services.store import store

router = APIRouter(prefix="/v1/exports", tags=["exports"])


@router.get("/{run_id}", response_model=ExportBundle)
def export_run(
    run_id: UUID,
    user: UserContext = Depends(require_roles("reviewer", "org_admin")),
) -> ExportBundle:
    existing = store.exports.get(run_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Export run not found")

    session_id = UUID(existing["session_id"])
    report_payload = store.reports.get(session_id)
    if report_payload is None:
        raise HTTPException(status_code=404, detail="Report not found for export")

    report = Report.model_validate(report_payload)
    bundle = build_export(run_id, report)
    audit(user, "export", "session", str(session_id), {"run_id": str(run_id)})
    return bundle
