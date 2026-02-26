from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import CoachMessageRequest, CoachResponse
from app.services.audit import audit
from app.services.coach import coach_reply
from app.services.store import store

router = APIRouter(prefix="/v1/sessions", tags=["coach"])


@router.post("/{session_id}/coach/message", response_model=CoachResponse)
def send_coach_message(
    session_id: UUID,
    payload: CoachMessageRequest,
    user: UserContext = Depends(require_roles("candidate")),
) -> CoachResponse:
    session = store.sessions.get(session_id)
    if session is None or session["tenant_id"] != user.tenant_id:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["candidate_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    task_family = store.task_families.get(UUID(session["task_family_id"]))
    case_id = task_family["case_id"] if task_family else None
    case = store.cases.get(UUID(case_id)) if case_id else None
    context = case["scenario"] if case else "Follow the scenario constraints and business context."

    response = coach_reply(payload.message, context)
    store.session_events[session_id].append(
        {
            "event_type": "coach_message",
            "payload": {
                "allowed": response.allowed,
                "policy_reason": response.policy_reason,
            },
        }
    )
    audit(user, "coach_message", "session", str(session_id), {"allowed": response.allowed})
    return response
