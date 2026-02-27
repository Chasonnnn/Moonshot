from __future__ import annotations

from statistics import mean
from uuid import UUID

from app.schemas import Interpretation, ScoreResult


def _metric(events: list[dict]) -> dict:
    query_runs = sum(1 for e in events if e.get("event_type") == "sql_query_run")
    query_errors = sum(1 for e in events if e.get("event_type") == "sql_query_error")
    ai_calls = sum(1 for e in events if e.get("event_type") == "copilot_invoked")
    verification_steps = sum(1 for e in events if e.get("event_type") == "verification_step_completed")
    policy_flags = sum(1 for e in events if e.get("payload", {}).get("policy_violation") is True)

    first_action = None
    for event in events:
        first_action = event.get("payload", {}).get("time_to_first_action_ms")
        if first_action is not None:
            break

    query_error_rate = (query_errors / query_runs) if query_runs else 0.0
    ai_accept_ratio = mean(
        [e.get("payload", {}).get("accept_ratio", 0.0) for e in events if e.get("event_type") == "copilot_output_accepted"]
        or [0.0]
    )

    return {
        "time_to_first_action_ms": first_action,
        "query_attempt_count": query_runs,
        "query_error_rate": round(query_error_rate, 3),
        "ai_prompt_count": ai_calls,
        "ai_accept_ratio": round(ai_accept_ratio, 3),
        "verification_steps": verification_steps,
        "policy_violation_count": policy_flags,
    }


def score_session(session_id: UUID, events: list[dict]) -> tuple[ScoreResult, Interpretation]:
    metrics = _metric(events)
    trigger_codes: list[str] = []

    base_score = 0.85
    base_score -= min(metrics["query_error_rate"], 0.4)
    if metrics["verification_steps"] == 0 and metrics["ai_prompt_count"] > 0:
        base_score -= 0.2
    if metrics["policy_violation_count"] > 0:
        base_score -= 0.25

    confidence = max(0.0, min(1.0, round(base_score, 3)))
    needs_review = confidence < 0.7 or metrics["policy_violation_count"] > 0
    if confidence < 0.7:
        trigger_codes.append("low_confidence")
    if metrics["policy_violation_count"] > 0:
        trigger_codes.append("policy_violation")
    if metrics["verification_steps"] == 0 and metrics["ai_prompt_count"] > 0:
        trigger_codes.append("high_ai_low_verification")

    dimension_scores = {
        "problem_framing": max(0.0, round(confidence - 0.03, 3)),
        "sql_quality": max(0.0, round(confidence - metrics["query_error_rate"] * 0.5, 3)),
        "evidence_reasoning": max(0.0, round(confidence - 0.02, 3)),
        "communication": max(0.0, round(confidence, 3)),
    }

    score_result = ScoreResult(
        session_id=session_id,
        objective_metrics=metrics,
        dimension_scores=dimension_scores,
        confidence=confidence,
        needs_human_review=needs_review,
        trigger_codes=trigger_codes,
    )

    suggestions = [
        "Probe how candidate validated data assumptions before conclusions.",
        "Ask for error-handling rationale across SQL iterations.",
    ]
    if needs_review:
        suggestions.append("Escalate to human reviewer due to low confidence or policy risk.")

    interpretation = Interpretation(
        summary=(
            "Candidate demonstrates structured analysis behavior."
            if confidence >= 0.7
            else "Candidate output requires additional human review for confidence/policy reasons."
        ),
        suggestions=suggestions,
    )

    return score_result, interpretation
