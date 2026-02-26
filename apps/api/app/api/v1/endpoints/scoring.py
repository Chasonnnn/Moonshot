from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Header, HTTPException

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import Report, ScoreResult
from app.services.audit import audit
from app.services.idempotency import get_cached, set_cached
from app.services.scoring import score_session
from app.services.store import store

router = APIRouter(prefix="/v1/sessions", tags=["scoring"])


@router.post("/{session_id}/score", response_model=ScoreResult)
def score(
    session_id: UUID,
    user: UserContext = Depends(require_roles("reviewer", "org_admin")),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> ScoreResult:
    cached = get_cached("score", idempotency_key)
    if cached is not None:
        return ScoreResult.model_validate(cached)

    session = store.sessions.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["status"] != "submitted":
        raise HTTPException(status_code=400, detail="Session must be submitted before scoring")

    events = store.session_events.get(session_id, [])
    score_result, interpretation = score_session(session_id, events)
    store.scores[session_id] = score_result.model_dump(mode="json")
    report = Report(session_id=session_id, score_result=score_result, interpretation=interpretation)
    store.reports[session_id] = report.model_dump(mode="json")

    export_run_id = uuid4()
    store.exports[export_run_id] = {"session_id": str(session_id)}

    session["status"] = "scored"
    store.sessions[session_id] = session

    payload = score_result.model_dump(mode="json")
    set_cached("score", idempotency_key, payload)
    audit(user, "score", "session", str(session_id), {"export_run_id": str(export_run_id)})
    return score_result
