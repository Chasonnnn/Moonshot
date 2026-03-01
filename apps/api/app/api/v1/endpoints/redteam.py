from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import JobAccepted, RedTeamRun, RedTeamRunCreate
from app.services.audit import audit
from app.services.jobs import submit_job
from app.services.redteam import get_redteam_run_for_tenant, list_redteam_runs_for_tenant

router = APIRouter(prefix="/v1/redteam/runs", tags=["redteam"])


@router.post("", response_model=JobAccepted, status_code=status.HTTP_202_ACCEPTED)
def create_redteam_run(
    payload: RedTeamRunCreate,
    user: UserContext = Depends(require_roles("org_admin")),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> JobAccepted:
    if idempotency_key is None or not idempotency_key.strip():
        raise HTTPException(status_code=400, detail="Missing Idempotency-Key header")

    accepted = submit_job(
        job_type="redteam",
        target_type=payload.target_type,
        target_id=payload.target_id,
        user=user,
        request_payload={"target_type": payload.target_type, "target_id": str(payload.target_id)},
        idempotency_key=idempotency_key,
    )
    audit(
        user,
        "submit_job",
        "redteam",
        str(payload.target_id),
        {"job_id": str(accepted.job_id), "target_type": payload.target_type},
    )
    return accepted


@router.get("", response_model=dict[str, list[RedTeamRun]])
def list_redteam_runs(
    target_type: str | None = Query(default=None),
    target_id: UUID | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=20, ge=1, le=100),
    user: UserContext = Depends(require_roles("org_admin", "reviewer")),
) -> dict[str, list[RedTeamRun]]:
    items = list_redteam_runs_for_tenant(
        user.tenant_id,
        target_type=target_type,
        target_id=target_id,
    )
    if status_filter is not None:
        items = [item for item in items if item.status == status_filter]
    items = items[:limit]
    return {"items": items}


@router.get("/{run_id}", response_model=RedTeamRun)
def get_redteam_run(
    run_id: UUID,
    user: UserContext = Depends(require_roles("org_admin", "reviewer")),
) -> RedTeamRun:
    run = get_redteam_run_for_tenant(user.tenant_id, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Red-team run not found")
    return run
