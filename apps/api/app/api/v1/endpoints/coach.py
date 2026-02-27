from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import CoachMessageRequest, CoachResponse
from app.services.audit import audit
from app.services.coach import coach_reply
from app.services.repositories import case_repository, session_repository

router = APIRouter(prefix="/v1/sessions", tags=["coach"])


@router.post("/{session_id}/coach/message", response_model=CoachResponse)
def send_coach_message(
    session_id: UUID,
    payload: CoachMessageRequest,
    user: UserContext = Depends(require_roles("candidate")),
) -> CoachResponse:
    session = session_repository.get_session(session_id)
    if session is None or session.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.candidate_id != user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    task_family = case_repository.get_task_family(session.task_family_id)
    case = case_repository.get_case(task_family.case_id) if task_family else None
    context = case.scenario if case else "Follow the scenario constraints and business context."

    response = coach_reply(payload.message, context)
    session_repository.append_events(
        session_id,
        [
            {
                "event_type": "coach_message",
                "payload": {
                    "allowed": response.allowed,
                    "policy_reason": response.policy_reason,
                    "policy_version": response.policy_version,
                    "blocked_rule_id": response.blocked_rule_id,
                },
            }
        ],
    )
    audit(
        user,
        "coach_message",
        "session",
        str(session_id),
        {
            "allowed": response.allowed,
            "policy_version": response.policy_version,
            "blocked_rule_id": response.blocked_rule_id,
        },
    )
    return response
