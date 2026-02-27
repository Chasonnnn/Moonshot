from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import WorkerHealthResponse
from app.services.workers import get_worker_health

router = APIRouter(prefix="/v1/workers", tags=["workers"])


@router.get("/health", response_model=WorkerHealthResponse)
def worker_health(
    user: UserContext = Depends(require_roles("org_admin")),
) -> WorkerHealthResponse:
    return get_worker_health(user.tenant_id)
