from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import BusinessContextPack, BusinessContextPackCreate, BusinessContextPackUpdate
from app.services.audit import audit
from app.services.store import store

router = APIRouter(prefix="/v1/business-context/packs", tags=["business-context"])


@router.post("", response_model=BusinessContextPack, status_code=status.HTTP_201_CREATED)
def create_pack(
    payload: BusinessContextPackCreate,
    user: UserContext = Depends(require_roles("org_admin")),
) -> BusinessContextPack:
    pack = BusinessContextPack(tenant_id=user.tenant_id, **payload.model_dump())
    store.business_context_packs[pack.id] = pack.model_dump(mode="json")
    audit(user, "create", "business_context_pack", str(pack.id))
    return pack


@router.get("", response_model=dict[str, list[BusinessContextPack]])
def list_packs(
    user: UserContext = Depends(require_roles("org_admin", "reviewer")),
) -> dict[str, list[BusinessContextPack]]:
    items = [
        BusinessContextPack.model_validate(row)
        for row in store.business_context_packs.values()
        if row["tenant_id"] == user.tenant_id
    ]
    return {"items": items}


@router.get("/{pack_id}", response_model=BusinessContextPack)
def get_pack(
    pack_id: UUID,
    user: UserContext = Depends(require_roles("org_admin", "reviewer")),
) -> BusinessContextPack:
    existing = store.business_context_packs.get(pack_id)
    if existing is None or existing["tenant_id"] != user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pack not found")
    return BusinessContextPack.model_validate(existing)


@router.patch("/{pack_id}", response_model=BusinessContextPack)
def update_pack(
    pack_id: UUID,
    payload: BusinessContextPackUpdate,
    user: UserContext = Depends(require_roles("org_admin")),
) -> BusinessContextPack:
    existing = store.business_context_packs.get(pack_id)
    if existing is None or existing["tenant_id"] != user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pack not found")
    merged = {**existing, **payload.model_dump(exclude_none=True)}
    pack = BusinessContextPack.model_validate(merged)
    store.business_context_packs[pack_id] = pack.model_dump(mode="json")
    audit(user, "update", "business_context_pack", str(pack_id))
    return pack
