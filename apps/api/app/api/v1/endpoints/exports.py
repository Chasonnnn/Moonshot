from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import ExportBundle, ExportCreateRequest, JobAccepted
from app.services.audit import audit
from app.services.exporting import build_export
from app.services.jobs import submit_job
from app.services.repositories import scoring_repository, session_repository

router = APIRouter(prefix="/v1/exports", tags=["exports"])


@router.post("", response_model=JobAccepted, status_code=status.HTTP_202_ACCEPTED)
def create_export_job(
    payload: ExportCreateRequest,
    user: UserContext = Depends(require_roles("reviewer", "org_admin")),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> JobAccepted:
    if idempotency_key is None or not idempotency_key.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing Idempotency-Key header")

    session = session_repository.get_session(payload.session_id)
    if session is None or session.tenant_id != user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    accepted = submit_job(
        job_type="export",
        target_type="session",
        target_id=payload.session_id,
        user=user,
        request_payload={"session_id": str(payload.session_id)},
        idempotency_key=idempotency_key,
    )
    audit(user, "submit_job", "session_export", str(payload.session_id), {"job_id": str(accepted.job_id)})
    return accepted


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
