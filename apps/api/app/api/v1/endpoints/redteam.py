from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import JobAccepted, RedTeamRunCreate
from app.services.audit import audit
from app.services.jobs import submit_job

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
