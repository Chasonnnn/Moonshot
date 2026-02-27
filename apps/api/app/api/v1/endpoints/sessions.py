from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import EventIngestResponse, EventsIngestRequest, Session, SessionCreate, SessionSubmitRequest
from app.services.admin_policy import get_policy
from app.services.audit import audit
from app.services.store import store

router = APIRouter(prefix="/v1/sessions", tags=["sessions"])


def _tenant_for_task_family(task_family_id: UUID) -> str:
    task_family = store.task_families.get(task_family_id)
    if task_family is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task family not found")
    case_id = UUID(task_family["case_id"])
    case_payload = store.cases.get(case_id)
    if case_payload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found for task family")
    return case_payload["tenant_id"]


def _get_session_for_tenant(session_id: UUID, tenant_id: str) -> Session:
    session_payload = store.sessions.get(session_id)
    if session_payload is None or session_payload["tenant_id"] != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return Session.model_validate(session_payload)


@router.post("", response_model=Session, status_code=status.HTTP_201_CREATED)
def create_session(
    payload: SessionCreate,
    user: UserContext = Depends(require_roles("org_admin", "reviewer")),
) -> Session:
    if _tenant_for_task_family(payload.task_family_id) != user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task family not found")

    tenant_policy = get_policy(user.tenant_id)
    resolved_policy = dict(payload.policy)
    resolved_policy.setdefault("raw_content_opt_in", tenant_policy.raw_content_default_opt_in)
    resolved_policy.setdefault("retention_ttl_days", tenant_policy.default_retention_ttl_days)

    ttl = int(resolved_policy["retention_ttl_days"])
    if ttl <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="retention_ttl_days must be > 0")
    if ttl > tenant_policy.max_retention_ttl_days:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"retention_ttl_days cannot exceed {tenant_policy.max_retention_ttl_days}",
        )

    session = Session(
        tenant_id=user.tenant_id,
        task_family_id=payload.task_family_id,
        candidate_id=payload.candidate_id,
        policy=resolved_policy,
    )
    store.sessions[session.id] = session.model_dump(mode="json")
    store.session_events[session.id] = []
    audit(user, "create", "session", str(session.id), {"candidate_id": payload.candidate_id})
    return session


@router.get("", response_model=dict[str, list[Session]])
def list_sessions(
    user: UserContext = Depends(require_roles("org_admin", "reviewer")),
) -> dict[str, list[Session]]:
    items = [
        Session.model_validate(row)
        for row in store.sessions.values()
        if row["tenant_id"] == user.tenant_id
    ]
    return {"items": items}


@router.get("/{session_id}", response_model=Session)
def get_session(
    session_id: UUID,
    user: UserContext = Depends(require_roles("org_admin", "reviewer", "candidate")),
) -> Session:
    session = _get_session_for_tenant(session_id, user.tenant_id)
    if user.role == "candidate" and session.candidate_id != user.user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return session


@router.post("/{session_id}/events", response_model=EventIngestResponse, status_code=status.HTTP_202_ACCEPTED)
def ingest_events(
    session_id: UUID,
    payload: EventsIngestRequest,
    user: UserContext = Depends(require_roles("candidate")),
) -> EventIngestResponse:
    session = _get_session_for_tenant(session_id, user.tenant_id)
    if session.candidate_id != user.user_id:
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
    existing = _get_session_for_tenant(session_id, user.tenant_id).model_dump(mode="json")
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
