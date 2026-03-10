from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, status

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import BusinessContextPack, BusinessContextPackCreate, BusinessContextPackUpdate
from app.services.audit import audit
from app.services.memory import sync_business_context_pack_memory
from app.services.repositories import business_context_repository

router = APIRouter(prefix="/v1/business-context/packs", tags=["business-context"])


@router.post("", response_model=BusinessContextPack, status_code=status.HTTP_201_CREATED)
def create_pack(
    payload: BusinessContextPackCreate,
    user: UserContext = Depends(require_roles("org_admin")),
) -> BusinessContextPack:
    pack = BusinessContextPack(tenant_id=user.tenant_id, **payload.model_dump())
    business_context_repository.save_pack(pack)
    sync_business_context_pack_memory(
        pack,
        created_by=user.user_id,
        reviewed_by=None,
        change_reason="pack_created",
    )
    audit(user, "create", "business_context_pack", str(pack.id))
    return pack


@router.get("", response_model=dict[str, list[BusinessContextPack]])
def list_packs(
    user: UserContext = Depends(require_roles("org_admin", "reviewer")),
) -> dict[str, list[BusinessContextPack]]:
    items = business_context_repository.list_packs(user.tenant_id)
    return {"items": items}


@router.get("/{pack_id}", response_model=BusinessContextPack)
def get_pack(
    pack_id: UUID,
    user: UserContext = Depends(require_roles("org_admin", "reviewer")),
) -> BusinessContextPack:
    existing = business_context_repository.get_pack(pack_id)
    if existing is None or existing.tenant_id != user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pack not found")
    return existing


@router.patch("/{pack_id}", response_model=BusinessContextPack)
def update_pack(
    pack_id: UUID,
    payload: BusinessContextPackUpdate,
    user: UserContext = Depends(require_roles("org_admin")),
) -> BusinessContextPack:
    existing = business_context_repository.get_pack(pack_id)
    if existing is None or existing.tenant_id != user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pack not found")

    if payload.status is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pack status transitions must use lifecycle endpoints",
        )
    if existing.status == "deprecated":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Deprecated pack cannot be edited")

    existing_payload = existing.model_dump(mode="json")
    merged = {**existing_payload, **payload.model_dump(exclude_none=True)}
    if existing.status in {"approved", "active"}:
        merged["status"] = "draft"
    pack = BusinessContextPack.model_validate(merged)
    business_context_repository.save_pack(pack)
    sync_business_context_pack_memory(
        pack,
        created_by=user.user_id,
        reviewed_by=None,
        change_reason="pack_updated",
    )
    audit(user, "update", "business_context_pack", str(pack_id))
    return pack


@router.post("/{pack_id}/review", response_model=BusinessContextPack)
def review_pack(
    pack_id: UUID,
    payload: dict[str, str] | None = Body(default=None),
    user: UserContext = Depends(require_roles("org_admin")),
) -> BusinessContextPack:
    existing = business_context_repository.get_pack(pack_id)
    if existing is None or existing.tenant_id != user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pack not found")
    if existing.status == "deprecated":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Deprecated pack cannot be reviewed")

    pack = existing.model_copy(update={"status": "approved"})
    business_context_repository.save_pack(pack)
    sync_business_context_pack_memory(
        pack,
        created_by=user.user_id,
        reviewed_by=user.user_id,
        change_reason=(payload or {}).get("review_note"),
    )
    audit(user, "review", "business_context_pack", str(pack_id), {"review_note": (payload or {}).get("review_note")})
    return pack


@router.post("/{pack_id}/activate", response_model=BusinessContextPack)
def activate_pack(
    pack_id: UUID,
    payload: dict[str, str] | None = Body(default=None),
    user: UserContext = Depends(require_roles("org_admin")),
) -> BusinessContextPack:
    existing = business_context_repository.get_pack(pack_id)
    if existing is None or existing.tenant_id != user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pack not found")
    if existing.status != "approved":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pack must be approved before activation")

    pack = existing.model_copy(update={"status": "active"})
    business_context_repository.save_pack(pack)
    sync_business_context_pack_memory(
        pack,
        created_by=user.user_id,
        reviewed_by=user.user_id,
        change_reason=(payload or {}).get("change_reason"),
    )
    audit(user, "activate", "business_context_pack", str(pack_id), {"change_reason": (payload or {}).get("change_reason")})
    return pack


@router.post("/{pack_id}/deprecate", response_model=BusinessContextPack)
def deprecate_pack(
    pack_id: UUID,
    payload: dict[str, str] | None = Body(default=None),
    user: UserContext = Depends(require_roles("org_admin")),
) -> BusinessContextPack:
    existing = business_context_repository.get_pack(pack_id)
    if existing is None or existing.tenant_id != user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pack not found")
    if existing.status == "deprecated":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Pack is already deprecated")

    pack = existing.model_copy(update={"status": "deprecated"})
    business_context_repository.save_pack(pack)
    sync_business_context_pack_memory(
        pack,
        created_by=user.user_id,
        reviewed_by=user.user_id,
        change_reason=(payload or {}).get("change_reason"),
    )
    audit(user, "deprecate", "business_context_pack", str(pack_id), {"change_reason": (payload or {}).get("change_reason")})
    return pack
