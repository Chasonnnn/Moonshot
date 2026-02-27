from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import InterpretationRequest, InterpretationView, Report
from app.services.audit import audit
from app.services.interpretation_views import create_interpretation_view, get_interpretation_view
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


@router.post("/{session_id}/interpret", response_model=InterpretationView, status_code=status.HTTP_201_CREATED)
def create_interpretation(
    session_id: UUID,
    payload: InterpretationRequest,
    user: UserContext = Depends(require_roles("reviewer", "org_admin")),
) -> InterpretationView:
    session = session_repository.get_session(session_id)
    if session is None or session.tenant_id != user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    try:
        view = create_interpretation_view(session_id, payload)
    except RuntimeError as exc:
        if str(exc) == "report_not_found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found") from exc
        raise
    audit(user, "interpret", "report", str(session_id), {"view_id": str(view.view_id)})
    return view


@router.get("/{session_id}/interpretations/{view_id}", response_model=InterpretationView)
def get_interpretation(
    session_id: UUID,
    view_id: UUID,
    user: UserContext = Depends(require_roles("reviewer", "org_admin")),
) -> InterpretationView:
    session = session_repository.get_session(session_id)
    if session is None or session.tenant_id != user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interpretation view not found")
    view = get_interpretation_view(session_id, view_id)
    if view is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interpretation view not found")
    return view
