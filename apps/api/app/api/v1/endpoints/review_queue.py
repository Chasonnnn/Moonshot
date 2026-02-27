from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import ReviewQueueItem, ReviewQueueResolveRequest
from app.services.audit import audit
from app.services.store import store

router = APIRouter(prefix="/v1/review-queue", tags=["review-queue"])


@router.get("", response_model=dict[str, list[ReviewQueueItem]])
def list_review_queue(
    include_resolved: bool = Query(default=False),
    user: UserContext = Depends(require_roles("reviewer", "org_admin")),
) -> dict[str, list[ReviewQueueItem]]:
    items: list[ReviewQueueItem] = []
    for row in store.review_queue.values():
        if row["tenant_id"] != user.tenant_id:
            continue
        if not include_resolved and row["status"] != "open":
            continue
        items.append(ReviewQueueItem.model_validate(row))
    return {"items": items}


@router.get("/{session_id}", response_model=ReviewQueueItem)
def get_review_queue_item(
    session_id: UUID,
    user: UserContext = Depends(require_roles("reviewer", "org_admin")),
) -> ReviewQueueItem:
    row = store.review_queue.get(session_id)
    if row is None or row["tenant_id"] != user.tenant_id:
        raise HTTPException(status_code=404, detail="Review queue item not found")
    return ReviewQueueItem.model_validate(row)


@router.post("/{session_id}/resolve", response_model=ReviewQueueItem)
def resolve_review_queue_item(
    session_id: UUID,
    payload: ReviewQueueResolveRequest,
    user: UserContext = Depends(require_roles("reviewer", "org_admin")),
) -> ReviewQueueItem:
    row = store.review_queue.get(session_id)
    if row is None or row["tenant_id"] != user.tenant_id:
        raise HTTPException(status_code=404, detail="Review queue item not found")
    if row["status"] != "open":
        raise HTTPException(status_code=400, detail="Review queue item already resolved")

    resolved = {
        **row,
        "status": "resolved",
        "resolution": payload.decision,
        "reviewer_note": payload.reviewer_note,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    store.review_queue[session_id] = resolved

    audit(
        user,
        "resolve",
        "review_queue_item",
        str(session_id),
        {"decision": payload.decision, "reviewer_note": payload.reviewer_note},
    )
    return ReviewQueueItem.model_validate(resolved)
