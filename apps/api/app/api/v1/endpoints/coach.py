from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import CoachFeedback, CoachFeedbackRequest, CoachMessageRequest, CoachResponse
from app.services.audit import audit
from app.services.coach import coach_reply
from app.services.context_injection import append_context_trace
from app.services.repositories import case_repository, session_repository
from app.services.store import store

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
    coach_mode = str(session.policy.get("coach_mode", "assessment")).strip().lower()
    if coach_mode not in {"assessment", "practice"}:
        coach_mode = "assessment"

    response = coach_reply(payload.message, context, mode=coach_mode)
    session_repository.append_events(
        session_id,
        [
            {
                "event_type": "coach_message",
                "payload": {
                    "allowed": response.allowed,
                    "policy_reason": response.policy_reason,
                    "policy_version": response.policy_version,
                    "policy_hash": response.policy_hash,
                    "blocked_rule_id": response.blocked_rule_id,
                },
            }
        ],
    )
    append_context_trace(
        session_id=session_id,
        tenant_id=user.tenant_id,
        agent_type="coach",
        actor_role=user.role,
        mode=coach_mode,
        context_keys=["case_scenario", "policy_constraints", "coach_policy"],
        policy_version=response.policy_version,
        policy_hash=response.policy_hash,
    )
    audit(
        user,
        "coach_message",
        "session",
        str(session_id),
        {
            "allowed": response.allowed,
            "policy_version": response.policy_version,
            "policy_hash": response.policy_hash,
            "blocked_rule_id": response.blocked_rule_id,
        },
    )
    return response


@router.post("/{session_id}/coach/feedback", response_model=CoachFeedback, status_code=status.HTTP_201_CREATED)
def submit_coach_feedback(
    session_id: UUID,
    payload: CoachFeedbackRequest,
    user: UserContext = Depends(require_roles("candidate")),
) -> CoachFeedback:
    session = session_repository.get_session(session_id)
    if session is None or session.tenant_id != user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if session.candidate_id != user.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    feedback = CoachFeedback(
        session_id=session_id,
        candidate_id=user.user_id,
        helpful=payload.helpful,
        confusion_tags=payload.confusion_tags,
        notes=payload.notes,
    )
    store.coach_feedback[feedback.id] = {**feedback.model_dump(mode="json"), "tenant_id": user.tenant_id}
    session_repository.append_events(
        session_id,
        [
            {
                "event_type": "coach_feedback_rated",
                "payload": {"helpful": payload.helpful, "confusion_tags": payload.confusion_tags},
            }
        ],
    )
    audit(
        user,
        "coach_feedback",
        "session",
        str(session_id),
        {"helpful": payload.helpful, "confusion_tags": payload.confusion_tags},
    )
    return feedback
