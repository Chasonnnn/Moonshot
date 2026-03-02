from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from app.schemas import GenerationResult, Interpretation, ModelInvocationTrace, Rubric, RubricDimension, ScoreResult, TaskFamily, TaskVariant
from app.schemas.contracts import CaseSpec


_FIXTURE_DEFAULT = "tpl_data_analyst"


_FIXTURE_PROFILES: dict[str, dict[str, Any]] = {
    "tpl_data_analyst": {
        "task_prompt": (
            "Investigate an 18% weekly conversion-rate decline, isolate likely root causes, "
            "validate with at least two checks, and propose actions with caveats."
        ),
        "rubric_dimensions": [
            ("analytical_depth", "Identifies root cause with concrete evidence from multiple slices."),
            ("sql_proficiency", "Uses correct SQL logic and iterative checks."),
            ("communication", "Communicates findings and uncertainty clearly."),
            ("verification", "Validates assumptions before conclusions."),
        ],
        "failure_modes": [
            "Jumps to conclusions without evidence.",
            "No uncertainty caveats.",
        ],
        "mock_score": {
            "confidence": 0.87,
            "dimension_scores": {
                "analytical_depth": 0.9,
                "sql_proficiency": 0.85,
                "communication": 0.88,
                "verification": 0.82,
            },
            "trigger_codes": ["strong_evidence_chain", "appropriate_caveats"],
        },
    },
    "tpl_jda_quality": {
        "task_prompt": (
            "Resolve the source-vs-dashboard row-count discrepancy, identify likely data-quality root causes, "
            "and document escalation-ready findings."
        ),
        "rubric_dimensions": [
            ("data_quality_process", "Systematically investigates missing and duplicate records."),
            ("sql_accuracy", "Writes accurate comparison and validation SQL."),
            ("documentation", "Documents findings with precise references."),
            ("escalation_judgment", "Escalates appropriately based on impact and certainty."),
        ],
        "failure_modes": [
            "No duplicate/missing split.",
            "Missing escalation rationale.",
        ],
        "mock_score": {
            "confidence": 0.82,
            "dimension_scores": {
                "data_quality_process": 0.85,
                "sql_accuracy": 0.8,
                "documentation": 0.84,
                "escalation_judgment": 0.78,
            },
            "trigger_codes": ["systematic_investigation"],
        },
    },
    "tpl_jda_ambiguity": {
        "task_prompt": (
            "Respond to an ambiguous stakeholder request by clarifying assumptions, asking targeted questions, "
            "and proposing a scoped deliverable."
        ),
        "rubric_dimensions": [
            ("ambiguity_recognition", "Identifies key ambiguities in the request."),
            ("assumption_documentation", "States assumptions explicitly and clearly."),
            ("communication_clarity", "Communicates professionally and with structure."),
            ("escalation_appropriateness", "Balances proactive delivery with clarification."),
        ],
        "failure_modes": [
            "Assumes scope without clarifying.",
            "Unclear stakeholder communication.",
        ],
        "mock_score": {
            "confidence": 0.91,
            "dimension_scores": {
                "ambiguity_recognition": 0.95,
                "assumption_documentation": 0.9,
                "communication_clarity": 0.92,
                "escalation_appropriateness": 0.88,
            },
            "trigger_codes": ["strong_communication", "proactive_clarification"],
        },
    },
}


def _normalize_template_id(template_id: str | None) -> str:
    candidate = (template_id or "").strip()
    if candidate in _FIXTURE_PROFILES:
        return candidate
    return _FIXTURE_DEFAULT


def _metric(events: list[dict[str, Any]]) -> dict[str, Any]:
    query_runs = sum(1 for e in events if e.get("event_type") == "sql_query_run")
    query_errors = sum(1 for e in events if e.get("event_type") == "sql_query_error")
    python_runs = sum(1 for e in events if e.get("event_type") == "python_code_run")
    ai_calls = sum(1 for e in events if e.get("event_type") == "copilot_invoked")
    verification_steps = sum(1 for e in events if e.get("event_type") == "verification_step_completed")
    policy_flags = sum(1 for e in events if e.get("payload", {}).get("policy_violation") is True)

    first_action = None
    for event in events:
        first_action = event.get("payload", {}).get("time_to_first_action_ms")
        if first_action is not None:
            break

    query_error_rate = (query_errors / query_runs) if query_runs else 0.0
    return {
        "time_to_first_action_ms": first_action,
        "query_attempt_count": query_runs,
        "query_error_rate": round(query_error_rate, 3),
        "python_run_count": python_runs,
        "ai_prompt_count": ai_calls,
        "verification_steps": verification_steps,
        "policy_violation_count": policy_flags,
    }


def _fixture_trace(template_id: str, seed_text: str) -> ModelInvocationTrace:
    prompt_hash = hashlib.sha256(seed_text.encode("utf-8")).hexdigest()[:16]
    return ModelInvocationTrace(
        provider="fixture",
        model=f"fixture:{template_id}",
        prompt_hash=prompt_hash,
        latency_ms=1,
    )


def generate_from_fixture(case: CaseSpec, *, template_id: str | None) -> GenerationResult:
    resolved = _normalize_template_id(template_id)
    profile = _FIXTURE_PROFILES[resolved]
    base_prompt = str(profile["task_prompt"])

    rubric = Rubric(
        dimensions=[
            RubricDimension(key=key, anchor=anchor) for key, anchor in profile["rubric_dimensions"]
        ],
        failure_modes=list(profile["failure_modes"]),
        version="fixture-v1",
    )

    variants = [
        TaskVariant(prompt=f"Variant A: {base_prompt}"),
        TaskVariant(prompt=f"Variant B: {base_prompt} Prioritize validation sequencing and traceability."),
        TaskVariant(prompt=f"Variant C: {base_prompt} Emphasize escalation criteria and risk communication."),
    ]

    task_family = TaskFamily(
        case_id=case.id,
        variants=variants,
        rubric_id=rubric.id,
        status="generated",
        version="fixture-v1",
        generation_diagnostics={
            "mode": "fixture",
            "template_id": resolved,
            "diversity_passed": True,
            "rubric_leakage_detected": False,
            "grounding_coverage_score": 1.0,
        },
    )

    return GenerationResult(
        task_family=task_family,
        rubric=rubric,
        model_trace=_fixture_trace(resolved, base_prompt),
    )


def score_from_fixture(
    *,
    session_id: UUID,
    template_id: str | None,
    events: list[dict[str, Any]],
    rubric_version: str,
    task_family_version: str,
) -> tuple[ScoreResult, Interpretation]:
    resolved = _normalize_template_id(template_id)
    profile = _FIXTURE_PROFILES[resolved]
    mock_score = profile["mock_score"]

    confidence = float(mock_score["confidence"])
    dimension_scores = dict(mock_score["dimension_scores"])
    trigger_codes = list(mock_score["trigger_codes"])
    if "fixture_score_profile" not in trigger_codes:
        trigger_codes.append("fixture_score_profile")

    score_result = ScoreResult(
        session_id=session_id,
        objective_metrics=_metric(events),
        dimension_scores=dimension_scores,
        confidence=confidence,
        needs_human_review=confidence < 0.7,
        scorer_version="0.2.0",
        rubric_version=rubric_version,
        task_family_version=task_family_version,
        model_hash=hashlib.sha256(f"fixture:{resolved}".encode("utf-8")).hexdigest()[:16],
        llm_traces=[
            ModelInvocationTrace(
                provider="fixture",
                model=f"fixture:{resolved}",
                prompt_hash=hashlib.sha256(f"{resolved}:{session_id}".encode("utf-8")).hexdigest()[:16],
                latency_ms=1,
            )
        ],
        trigger_codes=trigger_codes,
        trigger_impacts=[],
    )

    interpretation = Interpretation(
        summary=f"Fixture-evaluated performance profile for template '{resolved}'.",
        suggestions=[
            "Review candidate evidence chain for completeness.",
            "Validate escalation rationale against rubric anchors.",
        ],
    )
    return score_result, interpretation


def fixture_timestamp_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
