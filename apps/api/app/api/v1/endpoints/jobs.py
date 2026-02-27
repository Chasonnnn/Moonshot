from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import JobResultResponse, JobStatus
from app.services.jobs import get_job_result, get_job_status

router = APIRouter(prefix="/v1/jobs", tags=["jobs"])


@router.get("/{job_id}", response_model=JobStatus)
def get_job(
    job_id: UUID,
    user: UserContext = Depends(require_roles("org_admin", "reviewer", "candidate")),
) -> JobStatus:
    status_payload = get_job_status(job_id, user.tenant_id)
    if status_payload is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return status_payload


@router.get("/{job_id}/result", response_model=JobResultResponse)
def get_job_result_payload(
    job_id: UUID,
    user: UserContext = Depends(require_roles("org_admin", "reviewer", "candidate")),
) -> JobResultResponse:
    result = get_job_result(job_id, user.tenant_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return result
