from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import FairnessSmokeRun, FairnessSmokeRunCreate
from app.services.audit import audit
from app.services.fairness import create_fairness_smoke_run, get_fairness_smoke_run

router = APIRouter(prefix="/v1/fairness/smoke-runs", tags=["fairness"])


@router.post("", response_model=FairnessSmokeRun, status_code=status.HTTP_201_CREATED)
def create_smoke_run(
    payload: FairnessSmokeRunCreate,
    user: UserContext = Depends(require_roles("org_admin")),
) -> FairnessSmokeRun:
    run = create_fairness_smoke_run(user.tenant_id, payload)
    audit(
        user,
        "fairness_smoke_run",
        "fairness",
        str(run.id),
        {"scope": run.scope, "sample_size": run.summary.get("sample_size", 0)},
    )
    return run


@router.get("/{run_id}", response_model=FairnessSmokeRun)
def get_smoke_run(
    run_id: UUID,
    user: UserContext = Depends(require_roles("org_admin")),
) -> FairnessSmokeRun:
    run = get_fairness_smoke_run(run_id)
    if run is None or run.tenant_id != user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fairness smoke run not found")
    return run
