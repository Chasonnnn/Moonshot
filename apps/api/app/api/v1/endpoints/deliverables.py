from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import (
    Deliverable,
    DeliverableListResponse,
    DeliverableSubmitRequest,
)
from app.api.v1.endpoints.simulator_runtime import _get_session_for_access
from app.services.audit import audit
from app.services.repositories import session_repository
from app.services.store import store

router = APIRouter(prefix="/v1/sessions", tags=["deliverables"])


def _get_deliverable_or_404(deliverable_id: UUID) -> dict:
    row = store.session_deliverables.get(deliverable_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    return row


@router.post("/{session_id}/deliverables", response_model=Deliverable, status_code=201)
def create_deliverable(
    session_id: UUID,
    payload: DeliverableSubmitRequest,
    user: UserContext = Depends(require_roles("candidate")),
) -> Deliverable:
    _get_session_for_access(session_id, user)
    now = datetime.now(timezone.utc)
    deliverable_id = uuid4()
    row = {
        "id": str(deliverable_id),
        "session_id": str(session_id),
        "part_id": None,
        "content_markdown": payload.content_markdown,
        "embedded_artifacts": payload.embedded_artifacts,
        "status": "draft",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    store.session_deliverables[deliverable_id] = row
    audit(user, "create_deliverable", "session", str(session_id), {"deliverable_id": str(deliverable_id)})
    return Deliverable.model_validate(row)


@router.get("/{session_id}/deliverables", response_model=DeliverableListResponse)
def list_deliverables(
    session_id: UUID,
    user: UserContext = Depends(require_roles("candidate", "reviewer", "org_admin")),
) -> DeliverableListResponse:
    _get_session_for_access(session_id, user)
    items = []
    for row in store.session_deliverables.values():
        if row.get("session_id") == str(session_id):
            items.append(Deliverable.model_validate(row))
    return DeliverableListResponse(items=items)


@router.get("/{session_id}/deliverables/{deliverable_id}", response_model=Deliverable)
def get_deliverable(
    session_id: UUID,
    deliverable_id: UUID,
    user: UserContext = Depends(require_roles("candidate", "reviewer", "org_admin")),
) -> Deliverable:
    _get_session_for_access(session_id, user)
    row = _get_deliverable_or_404(deliverable_id)
    if row.get("session_id") != str(session_id):
        raise HTTPException(status_code=404, detail="Deliverable not found")
    return Deliverable.model_validate(row)


@router.put("/{session_id}/deliverables/{deliverable_id}", response_model=Deliverable)
def update_deliverable(
    session_id: UUID,
    deliverable_id: UUID,
    payload: DeliverableSubmitRequest,
    user: UserContext = Depends(require_roles("candidate")),
) -> Deliverable:
    _get_session_for_access(session_id, user)
    row = _get_deliverable_or_404(deliverable_id)
    if row.get("session_id") != str(session_id):
        raise HTTPException(status_code=404, detail="Deliverable not found")
    if row.get("status") == "submitted":
        raise HTTPException(status_code=409, detail="Cannot update a submitted deliverable")

    row["content_markdown"] = payload.content_markdown
    row["embedded_artifacts"] = payload.embedded_artifacts
    row["updated_at"] = datetime.now(timezone.utc).isoformat()
    store.session_deliverables[deliverable_id] = row
    audit(user, "update_deliverable", "session", str(session_id), {"deliverable_id": str(deliverable_id)})
    return Deliverable.model_validate(row)


@router.post("/{session_id}/deliverables/{deliverable_id}/submit", response_model=Deliverable)
def submit_deliverable(
    session_id: UUID,
    deliverable_id: UUID,
    user: UserContext = Depends(require_roles("candidate")),
) -> Deliverable:
    _get_session_for_access(session_id, user)
    row = _get_deliverable_or_404(deliverable_id)
    if row.get("session_id") != str(session_id):
        raise HTTPException(status_code=404, detail="Deliverable not found")
    if row.get("status") == "submitted":
        raise HTTPException(status_code=409, detail="Already submitted")

    row["status"] = "submitted"
    row["updated_at"] = datetime.now(timezone.utc).isoformat()
    store.session_deliverables[deliverable_id] = row
    session_repository.append_events(
        session_id,
        [{"event_type": "deliverable_submitted", "payload": {"deliverable_id": str(deliverable_id)}}],
    )
    audit(user, "submit_deliverable", "session", str(session_id), {"deliverable_id": str(deliverable_id)})
    return Deliverable.model_validate(row)
