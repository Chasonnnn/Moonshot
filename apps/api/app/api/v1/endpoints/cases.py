from uuid import UUID

from fastapi import APIRouter, Body, Depends, Header, HTTPException, status

from app.api.deps import RequestContext, require_roles, request_context
from app.core.security import UserContext
from app.schemas import CaseCreate, CaseGenerateRequest, CaseSpec, CaseUpdate, JobAccepted
from app.services.audit import audit
from app.services.jobs import submit_job
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


@router.post("/{case_id}/generate", response_model=JobAccepted, status_code=status.HTTP_202_ACCEPTED)
def generate_case(
    case_id: UUID,
    payload: CaseGenerateRequest | None = Body(default=None),
    user: UserContext = Depends(require_roles("org_admin")),
    context: RequestContext = Depends(request_context),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> JobAccepted:
    if idempotency_key is None or not idempotency_key.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing Idempotency-Key header")

    case = _get_case_for_tenant(case_id, user.tenant_id)
    request_payload = payload or CaseGenerateRequest()
    accepted = submit_job(
        job_type="generate",
        target_type="case",
        target_id=case.id,
        user=user,
        request_payload={
            "case_id": str(case.id),
            "mode": request_payload.mode,
            "template_id": request_payload.template_id,
            "request_id": context.request_id,
        },
        idempotency_key=idempotency_key,
    )
    audit(user, "submit_job", "case_generate", str(case.id), {"job_id": str(accepted.job_id)})
    return accepted
