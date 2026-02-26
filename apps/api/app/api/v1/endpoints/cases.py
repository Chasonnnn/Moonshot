from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import CaseCreate, CaseSpec, CaseUpdate, GenerationResult
from app.services.audit import audit
from app.services.generation import generate_from_case
from app.services.idempotency import get_cached, set_cached
from app.services.store import store

router = APIRouter(prefix="/v1/cases", tags=["cases"])


@router.post("", response_model=CaseSpec, status_code=status.HTTP_201_CREATED)
def create_case(
    payload: CaseCreate,
    user: UserContext = Depends(require_roles("org_admin")),
) -> CaseSpec:
    case = CaseSpec(tenant_id=user.tenant_id, **payload.model_dump())
    store.cases[case.id] = case.model_dump(mode="json")
    audit(user, "create", "case", str(case.id))
    return case


@router.patch("/{case_id}", response_model=CaseSpec)
def update_case(
    case_id: UUID,
    payload: CaseUpdate,
    user: UserContext = Depends(require_roles("org_admin")),
) -> CaseSpec:
    existing = store.cases.get(case_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
    merged = {**existing, **payload.model_dump(exclude_none=True)}
    case = CaseSpec.model_validate(merged)
    store.cases[case_id] = case.model_dump(mode="json")
    audit(user, "update", "case", str(case_id))
    return case


@router.post("/{case_id}/generate", response_model=GenerationResult)
def generate_case(
    case_id: UUID,
    user: UserContext = Depends(require_roles("org_admin")),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> GenerationResult:
    cached = get_cached("generate", idempotency_key)
    if cached is not None:
        return GenerationResult.model_validate(cached)

    existing = store.cases.get(case_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    case = CaseSpec.model_validate(existing)
    generated = generate_from_case(case)
    store.task_families[generated.task_family.id] = generated.task_family.model_dump(mode="json")
    store.rubrics[generated.rubric.id] = generated.rubric.model_dump(mode="json")

    payload = generated.model_dump(mode="json")
    set_cached("generate", idempotency_key, payload)
    audit(user, "generate", "case", str(case_id), {"task_family_id": str(generated.task_family.id)})
    return generated
