from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import Report
from app.services.audit import audit
from app.services.store import store

router = APIRouter(prefix="/v1/reports", tags=["reports"])


@router.get("/{session_id}", response_model=Report)
def get_report(
    session_id: UUID,
    user: UserContext = Depends(require_roles("reviewer", "org_admin")),
) -> Report:
    existing = store.reports.get(session_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Report not found")
    audit(user, "read", "report", str(session_id))
    return Report.model_validate(existing)
