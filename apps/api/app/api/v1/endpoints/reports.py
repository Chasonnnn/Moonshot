from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import Report
from app.services.audit import audit
from app.services.repositories import scoring_repository, session_repository

router = APIRouter(prefix="/v1/reports", tags=["reports"])


@router.get("/{session_id}", response_model=Report)
def get_report(
    session_id: UUID,
    user: UserContext = Depends(require_roles("reviewer", "org_admin")),
) -> Report:
    existing = scoring_repository.get_report(session_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Report not found")
    session = session_repository.get_session(session_id)
    if session is None or session.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Report not found")
    audit(user, "read", "report", str(session_id))
    return existing
