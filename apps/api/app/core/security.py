from dataclasses import dataclass

from fastapi import Header, HTTPException, status

ALLOWED_ROLES = {"org_admin", "reviewer", "candidate"}


@dataclass(frozen=True)
class UserContext:
    role: str
    user_id: str
    tenant_id: str


def get_user_context(
    x_role: str | None = Header(default=None, alias="X-Role"),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    x_tenant_id: str | None = Header(default=None, alias="X-Tenant-Id"),
) -> UserContext:
    if x_role is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing X-Role header")
    if x_role not in ALLOWED_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unknown role")
    return UserContext(role=x_role, user_id=x_user_id or "anonymous", tenant_id=x_tenant_id or "default")
