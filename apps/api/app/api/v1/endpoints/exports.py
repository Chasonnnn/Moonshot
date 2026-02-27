from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import ExportBundle, Report
from app.services.audit import audit
from app.services.exporting import build_export
from app.services.repositories import scoring_repository, session_repository

router = APIRouter(prefix="/v1/exports", tags=["exports"])


@router.get("/{run_id}", response_model=ExportBundle)
def export_run(
    run_id: UUID,
    user: UserContext = Depends(require_roles("reviewer", "org_admin")),
) -> ExportBundle:
    existing = scoring_repository.get_export_run(run_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Export run not found")

    session_id = UUID(existing["session_id"])
    session = session_repository.get_session(session_id)
    if session is None or session.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Export run not found")
    report = scoring_repository.get_report(session_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found for export")

    bundle = build_export(run_id, report)
    audit(user, "export", "session", str(session_id), {"run_id": str(run_id)})
    return bundle
