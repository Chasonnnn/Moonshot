from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import (
    EventIngestResponse,
    SessionEvent,
    SessionEventListResponse,
    EventsIngestRequest,
    Session,
    SessionCreate,
    SessionDetail,
    SessionModeRequest,
    SessionSubmitRequest,
)
from app.services.admin_policy import get_policy
from app.services.audit import audit
from app.services.repositories import case_repository, session_repository

router = APIRouter(prefix="/v1/sessions", tags=["sessions"])


def _tenant_for_task_family(task_family_id: UUID) -> str:
    tenant = case_repository.tenant_for_task_family(task_family_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task family not found")
    return tenant


def _get_session_for_tenant(session_id: UUID, tenant_id: str) -> Session:
    session = session_repository.get_session(session_id)
    if session is None or session.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return session


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
    resolved_policy.setdefault("coach_mode", "assessment")

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
    session_repository.save_session(session)
    audit(user, "create", "session", str(session.id), {"candidate_id": payload.candidate_id})
    return session


@router.get("", response_model=dict[str, list[Session]])
def list_sessions(
    user: UserContext = Depends(require_roles("org_admin", "reviewer")),
) -> dict[str, list[Session]]:
    items = session_repository.list_sessions(user.tenant_id)
    return {"items": items}


@router.get("/{session_id}", response_model=SessionDetail)
def get_session(
    session_id: UUID,
    user: UserContext = Depends(require_roles("org_admin", "reviewer", "candidate")),
) -> SessionDetail:
    session = _get_session_for_tenant(session_id, user.tenant_id)
    if user.role == "candidate" and session.candidate_id != user.user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    task_family = case_repository.get_task_family(session.task_family_id)
    if task_family is None or not task_family.variants:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Session task prompt unavailable")
    payload = session.model_dump(mode="json")
    payload["task_prompt"] = task_family.variants[0].prompt
    return SessionDetail.model_validate(payload)


@router.post("/{session_id}/events", response_model=EventIngestResponse, status_code=status.HTTP_202_ACCEPTED)
def ingest_events(
    session_id: UUID,
    payload: EventsIngestRequest,
    user: UserContext = Depends(require_roles("candidate")),
) -> EventIngestResponse:
    session = _get_session_for_tenant(session_id, user.tenant_id)
    if session.candidate_id != user.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    accepted = session_repository.append_events(session_id, payload.events)
    audit(user, "ingest", "event", str(session_id), {"count": len(payload.events)})
    return EventIngestResponse(accepted=accepted)


@router.get("/{session_id}/events", response_model=SessionEventListResponse)
def list_session_events(
    session_id: UUID,
    limit: int = Query(100, ge=1, le=500),
    cursor: int = Query(0, ge=0),
    event_type: str | None = Query(None),
    user: UserContext = Depends(require_roles("org_admin", "reviewer", "candidate")),
) -> SessionEventListResponse:
    session = _get_session_for_tenant(session_id, user.tenant_id)
    if user.role == "candidate" and session.candidate_id != user.user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    events = session_repository.list_events(session_id)
    if event_type:
        events = [event for event in events if str(event.get("event_type", "")) == event_type]

    total = len(events)
    page = events[cursor : cursor + limit]
    next_cursor = cursor + limit if cursor + limit < total else None

    items = [
        SessionEvent(
            event_type=str(event.get("event_type", "")),
            payload=event.get("payload", {}) if isinstance(event.get("payload"), dict) else {},
            timestamp=event.get("created_at") or datetime.now(timezone.utc).isoformat(),
        )
        for event in page
    ]
    return SessionEventListResponse(items=items, next_cursor=next_cursor, limit=limit, total=total)


@router.post("/{session_id}/submit", response_model=Session)
def submit_session(
    session_id: UUID,
    payload: SessionSubmitRequest,
    user: UserContext = Depends(require_roles("candidate")),
) -> Session:
    existing = _get_session_for_tenant(session_id, user.tenant_id)
    if existing.candidate_id != user.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    existing_payload = existing.model_dump(mode="json")
    merged = {
        **existing_payload,
        "status": "submitted",
    }
    if existing.policy.get("raw_content_opt_in", False):
        merged["final_response"] = payload.final_response

    session = Session.model_validate(merged)
    session_repository.save_session(session)
    audit(user, "submit", "session", str(session_id))
    return session


@router.post("/{session_id}/mode", response_model=Session)
def set_session_coaching_mode(
    session_id: UUID,
    payload: SessionModeRequest,
    user: UserContext = Depends(require_roles("org_admin", "reviewer")),
) -> Session:
    existing = _get_session_for_tenant(session_id, user.tenant_id)
    requested_mode = payload.mode

    merged = existing.model_dump(mode="json")
    merged_policy = dict(merged.get("policy", {}))
    merged_policy["coach_mode"] = requested_mode
    merged["policy"] = merged_policy
    session = Session.model_validate(merged)
    session_repository.save_session(session)
    audit(user, "set_mode", "session", str(session_id), {"coach_mode": requested_mode})
    return session
