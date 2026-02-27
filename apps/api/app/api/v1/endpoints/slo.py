from fastapi import APIRouter, Depends

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import SLOProbeResponse
from app.services.slo import run_slo_probes

router = APIRouter(prefix="/v1/slo", tags=["slo"])


@router.get("/probes", response_model=SLOProbeResponse)
def slo_probes(
    user: UserContext = Depends(require_roles("org_admin")),
) -> SLOProbeResponse:
    return run_slo_probes(user.tenant_id)
