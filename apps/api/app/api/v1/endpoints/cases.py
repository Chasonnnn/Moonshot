from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import CaseCreate, CaseSpec, CaseUpdate, GenerationResult
from app.services.audit import audit
from app.services.generation import generate_from_case
from app.services.idempotency import get_cached, set_cached
from app.services.repositories import case_repository

router = APIRouter(prefix="/v1/cases", tags=["cases"])


def _get_case_for_tenant(case_id: UUID, tenant_id: str) -> CaseSpec:
    existing = case_repository.get_case(case_id)
    if existing is None or existing.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
    return existing


@router.post("", response_model=CaseSpec, status_code=status.HTTP_201_CREATED)
def create_case(
    payload: CaseCreate,
    user: UserContext = Depends(require_roles("org_admin")),
) -> CaseSpec:
    case = CaseSpec(tenant_id=user.tenant_id, **payload.model_dump())
    case_repository.save_case(case)
    audit(user, "create", "case", str(case.id))
    return case


@router.get("", response_model=dict[str, list[CaseSpec]])
def list_cases(
    user: UserContext = Depends(require_roles("org_admin", "reviewer")),
) -> dict[str, list[CaseSpec]]:
    items = case_repository.list_cases(user.tenant_id)
    return {"items": items}


@router.get("/{case_id}", response_model=CaseSpec)
def get_case(
    case_id: UUID,
    user: UserContext = Depends(require_roles("org_admin", "reviewer")),
) -> CaseSpec:
    return _get_case_for_tenant(case_id, user.tenant_id)


@router.patch("/{case_id}", response_model=CaseSpec)
def update_case(
    case_id: UUID,
    payload: CaseUpdate,
    user: UserContext = Depends(require_roles("org_admin")),
) -> CaseSpec:
    existing = _get_case_for_tenant(case_id, user.tenant_id).model_dump(mode="json")
    merged = {**existing, **payload.model_dump(exclude_none=True)}
    case = CaseSpec.model_validate(merged)
    case_repository.save_case(case)
    audit(user, "update", "case", str(case_id))
    return case


@router.post("/{case_id}/generate", response_model=GenerationResult)
def generate_case(
    case_id: UUID,
    user: UserContext = Depends(require_roles("org_admin")),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> GenerationResult:
    cache_scope = f"{user.tenant_id}:generate"
    cached = get_cached(cache_scope, idempotency_key)
    if cached is not None:
        return GenerationResult.model_validate(cached)

    case = _get_case_for_tenant(case_id, user.tenant_id)
    generated = generate_from_case(case)
    case_repository.save_task_family(generated.task_family)
    case_repository.save_rubric(generated.rubric)

    payload = generated.model_dump(mode="json")
    set_cached(cache_scope, idempotency_key, payload)
    audit(user, "generate", "case", str(case_id), {"task_family_id": str(generated.task_family.id)})
    return generated
