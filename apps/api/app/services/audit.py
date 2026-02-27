from __future__ import annotations

from app.core.security import UserContext
from app.schemas import AuditLog
from app.services.repositories import governance_repository


def audit(user: UserContext, action: str, resource_type: str, resource_id: str, metadata: dict | None = None) -> AuditLog:
    entry = AuditLog(
        tenant_id=user.tenant_id,
        actor_role=user.role,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        metadata=metadata or {},
    )
    governance_repository.append_audit_log(entry.model_dump(mode="json"))
    return entry
