from fastapi import APIRouter, Depends, Header, status

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import RedTeamRun, RedTeamRunCreate
from app.services.audit import audit
from app.services.idempotency import get_cached, set_cached
from app.services.redteam import run_redteam
from app.services.store import store

router = APIRouter(prefix="/v1/redteam/runs", tags=["redteam"])


@router.post("", response_model=RedTeamRun, status_code=status.HTTP_201_CREATED)
def create_redteam_run(
    payload: RedTeamRunCreate,
    user: UserContext = Depends(require_roles("org_admin")),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> RedTeamRun:
    cache_scope = f"{user.tenant_id}:redteam"
    cached = get_cached(cache_scope, idempotency_key)
    if cached is not None:
        return RedTeamRun.model_validate(cached)

    result = run_redteam(payload.target_type, payload.target_id)
    store.redteam_runs[result.id] = result.model_dump(mode="json")

    response_payload = result.model_dump(mode="json")
    set_cached(cache_scope, idempotency_key, response_payload)
    audit(user, "run", "redteam", str(result.id), {"target_type": payload.target_type, "target_id": str(payload.target_id)})
    return result
