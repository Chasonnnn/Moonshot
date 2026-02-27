from fastapi import APIRouter, Depends, Query

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import AuditChainVerificationResponse, AuditLog
from app.services.audit_integrity import verify_audit_chain
from app.services.store import store

router = APIRouter(prefix="/v1/audit-logs", tags=["audit"])


@router.get("", response_model=dict[str, list[AuditLog]])
def list_audit_logs(
    resource_type: str | None = Query(default=None),
    action: str | None = Query(default=None),
    user: UserContext = Depends(require_roles("org_admin")),
) -> dict[str, list[AuditLog]]:
    items = []
    for row in store.audit_logs:
        if row.get("tenant_id") != user.tenant_id:
            continue
        if resource_type and row.get("resource_type") != resource_type:
            continue
        if action and row.get("action") != action:
            continue
        items.append(AuditLog.model_validate(row))
    return {"items": items}


@router.get("/verify", response_model=AuditChainVerificationResponse)
def verify_audit_logs(
    user: UserContext = Depends(require_roles("org_admin")),
) -> AuditChainVerificationResponse:
    tenant_entries = [row for row in store.audit_logs if row.get("tenant_id") == user.tenant_id]
    result = verify_audit_chain(tenant_entries)
    return AuditChainVerificationResponse(
        valid=result.valid,
        checked_entries=result.checked_entries,
        error_code=result.error_code,
        error_detail=result.error_detail,
        failed_index=result.failed_index,
    )
