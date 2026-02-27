from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import FairnessSmokeRun, FairnessSmokeRunCreate, JobAccepted
from app.services.audit import audit
from app.services.fairness import get_fairness_smoke_run
from app.services.jobs import submit_job

router = APIRouter(prefix="/v1/fairness/smoke-runs", tags=["fairness"])


@router.post("", response_model=JobAccepted, status_code=status.HTTP_202_ACCEPTED)
def create_smoke_run(
    payload: FairnessSmokeRunCreate,
    user: UserContext = Depends(require_roles("org_admin")),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> JobAccepted:
    if idempotency_key is None or not idempotency_key.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing Idempotency-Key header")

    accepted = submit_job(
        job_type="fairness_smoke_run",
        target_type="tenant",
        target_id=UUID("00000000-0000-0000-0000-000000000000"),
        user=user,
        request_payload=payload.model_dump(mode="json"),
        idempotency_key=idempotency_key,
    )
    audit(
        user,
        "submit_job",
        "fairness",
        user.tenant_id,
        {"job_id": str(accepted.job_id), "scope": payload.scope},
    )
    return accepted


@router.get("/{run_id}", response_model=FairnessSmokeRun)
def get_smoke_run(
    run_id: UUID,
    user: UserContext = Depends(require_roles("org_admin")),
) -> FairnessSmokeRun:
    run = get_fairness_smoke_run(run_id)
    if run is None or run.tenant_id != user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fairness smoke run not found")
    return run
