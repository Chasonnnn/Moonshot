from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import JobResultResponse, JobStatus, JobStatusListResponse
from app.services.jobs import get_job_result, get_job_status, get_jobs_for_tenant

router = APIRouter(prefix="/v1/jobs", tags=["jobs"])


@router.get("", response_model=JobStatusListResponse)
def list_jobs(
    status: str | None = Query(default=None),
    job_type: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    user: UserContext = Depends(require_roles("org_admin", "reviewer")),
) -> JobStatusListResponse:
    items = get_jobs_for_tenant(user.tenant_id, status=status, job_type=job_type, limit=limit)
    return JobStatusListResponse(items=items)


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
