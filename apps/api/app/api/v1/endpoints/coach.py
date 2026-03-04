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


ALLOWED_COACH_MODES = {
    "practice",
    "assessment",
    "assessment_no_ai",
    "assessment_ai_assisted",
}


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
    if coach_mode not in ALLOWED_COACH_MODES:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invalid session coach_mode policy")

    if coach_mode == "assessment_no_ai":
        blocked_payload = {
            "allowed": False,
            "policy_reason": "coach_disabled_for_mode",
            "policy_decision_code": "blocked_mode_disabled",
            "policy_version": None,
            "policy_hash": None,
            "blocked_rule_id": "assessment_no_ai",
            "coach_mode": coach_mode,
        }
        session_repository.append_events(
            session_id,
            [
                {
                    "event_type": "coach_message",
                    "payload": blocked_payload,
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
            policy_version=None,
            policy_hash=None,
        )
        audit(
            user,
            "coach_message",
            "session",
            str(session_id),
            blocked_payload,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="coach is disabled in assessment_no_ai mode",
        )

    coach_engine_mode = "practice" if coach_mode == "practice" else "assessment"

    response = coach_reply(
        payload.message,
        context,
        mode=coach_engine_mode,
        model_override=payload.model_override,
        reasoning_effort=payload.reasoning_effort,
        thinking_budget_tokens=payload.thinking_budget_tokens,
    )
    session_repository.append_events(
        session_id,
        [
            {
                "event_type": "coach_message",
                "payload": {
                "allowed": response.allowed,
                "policy_reason": response.policy_reason,
                "policy_decision_code": response.policy_decision_code,
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
            "policy_decision_code": response.policy_decision_code,
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
