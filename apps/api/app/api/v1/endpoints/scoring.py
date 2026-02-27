from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import JobAccepted
from app.services.audit import audit
from app.services.jobs import submit_job
from app.services.repositories import session_repository

router = APIRouter(prefix="/v1/sessions", tags=["scoring"])


@router.post("/{session_id}/score", response_model=JobAccepted, status_code=202)
def score(
    session_id: UUID,
    user: UserContext = Depends(require_roles("reviewer", "org_admin")),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> JobAccepted:
    if idempotency_key is None or not idempotency_key.strip():
        raise HTTPException(status_code=400, detail="Missing Idempotency-Key header")

    session = session_repository.get_session(session_id)
    if session is None or session.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "submitted":
        raise HTTPException(status_code=400, detail="Session must be submitted before scoring")

    accepted = submit_job(
        job_type="score",
        target_type="session",
        target_id=session_id,
        user=user,
        request_payload={"session_id": str(session_id)},
        idempotency_key=idempotency_key,
    )
    audit(user, "submit_job", "session_score", str(session_id), {"job_id": str(accepted.job_id)})
    return accepted
