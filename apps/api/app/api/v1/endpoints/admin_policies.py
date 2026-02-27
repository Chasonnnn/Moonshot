from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import (
    AdminPolicy,
    AdminPolicyUpdateRequest,
    PurgeExpiredRequest,
    PurgeExpiredResponse,
)
from app.services.admin_policy import get_policy, save_policy
from app.services.audit import audit
from app.services.store import store

router = APIRouter(prefix="/v1/admin/policies", tags=["admin-policies"])


@router.get("", response_model=AdminPolicy)
def get_admin_policy(
    user: UserContext = Depends(require_roles("org_admin")),
) -> AdminPolicy:
    return get_policy(user.tenant_id)


@router.patch("", response_model=AdminPolicy)
def patch_admin_policy(
    payload: AdminPolicyUpdateRequest,
    user: UserContext = Depends(require_roles("org_admin")),
) -> AdminPolicy:
    current = get_policy(user.tenant_id)

    merged = current.model_dump()
    merged.update(payload.model_dump(exclude_none=True))

    if merged["default_retention_ttl_days"] <= 0:
        raise HTTPException(status_code=400, detail="default_retention_ttl_days must be > 0")
    if merged["max_retention_ttl_days"] <= 0:
        raise HTTPException(status_code=400, detail="max_retention_ttl_days must be > 0")
    if merged["default_retention_ttl_days"] > merged["max_retention_ttl_days"]:
        raise HTTPException(status_code=400, detail="default_retention_ttl_days cannot exceed max_retention_ttl_days")

    updated = AdminPolicy.model_validate(merged)
    saved = save_policy(updated)
    audit(user, "update", "admin_policy", user.tenant_id, payload.model_dump(exclude_none=True))
    return saved


@router.post("/purge-expired", response_model=PurgeExpiredResponse)
def purge_expired_raw_content(
    payload: PurgeExpiredRequest,
    user: UserContext = Depends(require_roles("org_admin")),
) -> PurgeExpiredResponse:
    now = datetime.now(timezone.utc)
    policy = get_policy(user.tenant_id)
    purged = 0

    for _, session in store.sessions.items():
        if session.get("tenant_id") != user.tenant_id:
            continue
        if not session.get("policy", {}).get("raw_content_opt_in", policy.raw_content_default_opt_in):
            continue
        if session.get("final_response") in (None, ""):
            continue

        ttl_days = int(session.get("policy", {}).get("retention_ttl_days", policy.default_retention_ttl_days))
        created_at = datetime.fromisoformat(session["created_at"])
        expires_at = created_at + timedelta(days=ttl_days)
        if now < expires_at:
            continue

        purged += 1
        if not payload.dry_run:
            session["final_response"] = None
            session["updated_at"] = now.isoformat()

    audit(
        user,
        "purge_expired",
        "session_raw_content",
        user.tenant_id,
        {"purged_sessions": purged, "dry_run": payload.dry_run},
    )
    return PurgeExpiredResponse(purged_sessions=purged, dry_run=payload.dry_run)
