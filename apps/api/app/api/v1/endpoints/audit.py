from fastapi import APIRouter, Depends, Query

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import AuditLog
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
