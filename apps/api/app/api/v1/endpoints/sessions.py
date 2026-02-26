from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import EventIngestResponse, EventsIngestRequest, Session, SessionCreate, SessionSubmitRequest
from app.services.audit import audit
from app.services.store import store

router = APIRouter(prefix="/v1/sessions", tags=["sessions"])


@router.post("", response_model=Session, status_code=status.HTTP_201_CREATED)
def create_session(
    payload: SessionCreate,
    user: UserContext = Depends(require_roles("org_admin", "reviewer")),
) -> Session:
    task_family = store.task_families.get(payload.task_family_id)
    if task_family is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task family not found")

    session = Session(
        tenant_id=user.tenant_id,
        task_family_id=payload.task_family_id,
        candidate_id=payload.candidate_id,
        policy=payload.policy,
    )
    store.sessions[session.id] = session.model_dump(mode="json")
    store.session_events[session.id] = []
    audit(user, "create", "session", str(session.id), {"candidate_id": payload.candidate_id})
    return session


@router.post("/{session_id}/events", response_model=EventIngestResponse, status_code=status.HTTP_202_ACCEPTED)
def ingest_events(
    session_id: UUID,
    payload: EventsIngestRequest,
    user: UserContext = Depends(require_roles("candidate")),
) -> EventIngestResponse:
    session = store.sessions.get(session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if session["candidate_id"] != user.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    for event in payload.events:
        store.session_events[session_id].append(event.model_dump(mode="json"))
    audit(user, "ingest", "event", str(session_id), {"count": len(payload.events)})
    return EventIngestResponse(accepted=len(payload.events))


@router.post("/{session_id}/submit", response_model=Session)
def submit_session(
    session_id: UUID,
    payload: SessionSubmitRequest,
    user: UserContext = Depends(require_roles("candidate")),
) -> Session:
    existing = store.sessions.get(session_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if existing["candidate_id"] != user.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    merged = {
        **existing,
        "status": "submitted",
    }
    if existing.get("policy", {}).get("raw_content_opt_in", False):
        merged["final_response"] = payload.final_response

    session = Session.model_validate(merged)
    store.sessions[session_id] = session.model_dump(mode="json")
    audit(user, "submit", "session", str(session_id))
    return session
