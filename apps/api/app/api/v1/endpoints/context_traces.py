from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import ContextInjectionTraceListResponse
from app.services.context_injection import list_context_traces
from app.services.repositories import session_repository

router = APIRouter(prefix="/v1/context/injection-traces", tags=["context-traces"])


@router.get("/{session_id}", response_model=ContextInjectionTraceListResponse)
def get_context_injection_traces(
    session_id: UUID,
    user: UserContext = Depends(require_roles("org_admin", "reviewer")),
) -> ContextInjectionTraceListResponse:
    session = session_repository.get_session(session_id)
    if session is None or session.tenant_id != user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    items = list_context_traces(session_id)
    return ContextInjectionTraceListResponse(items=items)
