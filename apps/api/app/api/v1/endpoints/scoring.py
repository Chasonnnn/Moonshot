from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Header, HTTPException

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import Report, ReviewQueueItem, ScoreResult, Session
from app.services.audit import audit
from app.services.idempotency import get_cached, set_cached
from app.services.repositories import scoring_repository, session_repository
from app.services.scoring import score_session

router = APIRouter(prefix="/v1/sessions", tags=["scoring"])


@router.post("/{session_id}/score", response_model=ScoreResult)
def score(
    session_id: UUID,
    user: UserContext = Depends(require_roles("reviewer", "org_admin")),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> ScoreResult:
    cache_scope = f"{user.tenant_id}:score"
    cached = get_cached(cache_scope, idempotency_key)
    if cached is not None:
        return ScoreResult.model_validate(cached)

    session = session_repository.get_session(session_id)
    if session is None or session.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "submitted":
        raise HTTPException(status_code=400, detail="Session must be submitted before scoring")

    events = session_repository.list_events(session_id)
    score_result, interpretation = score_session(session_id, events)
    scoring_repository.save_score(score_result)
    report = Report(session_id=session_id, score_result=score_result, interpretation=interpretation)
    scoring_repository.save_report(report)

    if score_result.needs_human_review:
        review_item = ReviewQueueItem(
            session_id=session_id,
            tenant_id=user.tenant_id,
            reason="score_flagged_for_human_review",
            created_by=user.user_id,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        scoring_repository.save_review_item(review_item)

    export_run_id = uuid4()
    scoring_repository.save_export_run(export_run_id, session_id)

    updated_session = Session.model_validate({**session.model_dump(mode="json"), "status": "scored"})
    session_repository.save_session(updated_session)

    payload = score_result.model_dump(mode="json")
    set_cached(cache_scope, idempotency_key, payload)
    audit(user, "score", "session", str(session_id), {"export_run_id": str(export_run_id)})
    return score_result
