from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import MemoryEntry, MemoryEntryListResponse, SessionMemoryDigest
from app.services.repositories import session_repository
from app.services.store import store

router = APIRouter(prefix="/v1/memory", tags=["memory"])


@router.get("/entries", response_model=MemoryEntryListResponse)
def list_memory_entries(
    layer: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    user: UserContext = Depends(require_roles("org_admin", "reviewer")),
) -> MemoryEntryListResponse:
    items: list[MemoryEntry] = []
    for payload in store.memory_entries.values():
        if payload.get("tenant_id") != user.tenant_id:
            continue
        if layer is not None and payload.get("layer") != layer:
            continue
        if status_filter is not None and payload.get("status") != status_filter:
            continue
        items.append(MemoryEntry.model_validate(payload))
    return MemoryEntryListResponse(items=items)


@router.get("/entries/{entry_id}", response_model=MemoryEntry)
def get_memory_entry(
    entry_id: UUID,
    user: UserContext = Depends(require_roles("org_admin", "reviewer")),
) -> MemoryEntry:
    payload = store.memory_entries.get(entry_id)
    if payload is None or payload.get("tenant_id") != user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory entry not found")
    return MemoryEntry.model_validate(payload)


@router.get("/session-digests/{session_id}", response_model=SessionMemoryDigest)
def get_session_memory_digest(
    session_id: UUID,
    user: UserContext = Depends(require_roles("org_admin", "reviewer")),
) -> SessionMemoryDigest:
    session = session_repository.get_session(session_id)
    if session is None or session.tenant_id != user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    payload = store.session_memory_digests.get(session_id)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session memory digest not found")
    return SessionMemoryDigest.model_validate(payload)
