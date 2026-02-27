from __future__ import annotations

from app.schemas import AdminPolicy
from app.services.store import store


def get_policy(tenant_id: str) -> AdminPolicy:
    payload = store.admin_policies.get(tenant_id)
    if payload is None:
        policy = AdminPolicy(tenant_id=tenant_id)
        store.admin_policies[tenant_id] = policy.model_dump(mode="json")
        return policy
    return AdminPolicy.model_validate(payload)


def save_policy(policy: AdminPolicy) -> AdminPolicy:
    store.admin_policies[policy.tenant_id] = policy.model_dump(mode="json")
    return policy
