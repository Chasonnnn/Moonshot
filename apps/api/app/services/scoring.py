from __future__ import annotations

import hashlib
from statistics import mean
from typing import Any
from uuid import UUID

from pydantic import ValidationError

from app.providers.contracts import EvaluatorProvider
from app.schemas import Interpretation, ModelInvocationTrace, ScoreResult
from app.schemas.contracts import DimensionScoreOutput, HolisticScoreOutput, Rubric, RubricDimension, ScoringConfig


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


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, round(float(value), 3)))


def _append_trigger(trigger_codes: list[str], code: str) -> None:
    if code not in trigger_codes:
        trigger_codes.append(code)


def _append_trigger_impact(trigger_impacts: list[dict[str, float | str]], code: str, delta: float) -> None:
    if any(item.get("code") == code for item in trigger_impacts):
        return
    trigger_impacts.append({"code": code, "delta": round(float(delta), 3)})


def _heuristic_score(metrics: dict[str, Any]) -> tuple[float, dict[str, float], list[str], list[dict[str, float | str]]]:
    trigger_codes: list[str] = []
    trigger_impacts: list[dict[str, float | str]] = []

    base_score = 0.85
    base_score -= min(float(metrics["query_error_rate"]), 0.4)
    if int(metrics["verification_steps"]) == 0 and int(metrics["ai_prompt_count"]) > 0:
        base_score -= 0.2
    if int(metrics["policy_violation_count"]) > 0:
        base_score -= 0.25

    confidence = _clamp01(base_score)
    if confidence < 0.7:
        _append_trigger(trigger_codes, "low_confidence")
        _append_trigger_impact(trigger_impacts, "low_confidence", confidence - 0.7)
    if int(metrics["policy_violation_count"]) > 0:
        _append_trigger(trigger_codes, "policy_violation")
        _append_trigger_impact(trigger_impacts, "policy_violation", -0.25)
    if int(metrics["verification_steps"]) == 0 and int(metrics["ai_prompt_count"]) > 0:
        _append_trigger(trigger_codes, "high_ai_low_verification")
        _append_trigger_impact(trigger_impacts, "high_ai_low_verification", -0.2)

    dimension_scores = {
        "problem_framing": _clamp01(confidence - 0.03),
        "sql_quality": _clamp01(confidence - float(metrics["query_error_rate"]) * 0.5),
        "evidence_reasoning": _clamp01(confidence - 0.02),
        "communication": _clamp01(confidence),
    }

    return confidence, dimension_scores, trigger_codes, trigger_impacts


def _heuristic_interpretation(confidence: float, needs_review: bool) -> Interpretation:
    suggestions = [
        "Probe how candidate validated data assumptions before conclusions.",
        "Ask for error-handling rationale across SQL iterations.",
    ]
    if needs_review:
        suggestions.append("Escalate to human reviewer due to low confidence or policy risk.")

    return Interpretation(
        summary=(
            "Candidate demonstrates structured analysis behavior."
            if confidence >= 0.7
            else "Candidate output requires additional human review for confidence/policy reasons."
        ),
        suggestions=suggestions,
    )


def _effective_scoring_config(scoring_config: ScoringConfig | None) -> ScoringConfig:
    if scoring_config is None:
        return ScoringConfig()
    return scoring_config


def _deterministic_rules(metrics: dict[str, Any], cfg: ScoringConfig) -> tuple[list[str], float]:
    triggers: list[str] = []
    penalty = 0.0

    if int(metrics["verification_steps"]) < int(cfg.min_verification_steps):
        _append_trigger(triggers, "verification_below_min")
        penalty += 0.05

    if float(metrics["query_error_rate"]) > float(cfg.max_query_error_rate):
        _append_trigger(triggers, "query_error_rate_exceeded")
        penalty += min(0.2, float(metrics["query_error_rate"]) - float(cfg.max_query_error_rate))

    first_action = metrics.get("time_to_first_action_ms")
    if cfg.idle_threshold_ms is not None and isinstance(first_action, (int, float)) and float(first_action) > float(cfg.idle_threshold_ms):
        _append_trigger(triggers, "idle_threshold_exceeded")
        penalty += 0.05

    try:
        custom_penalty = float(cfg.custom_rules.get("confidence_penalty", 0.0))
    except (TypeError, ValueError):
        custom_penalty = 0.0
    if custom_penalty > 0:
        _append_trigger(triggers, "custom_confidence_penalty")
        penalty += min(custom_penalty, 0.3)

    return triggers, penalty


def _sanitize_final_response(text: str | None) -> str:
    if text is None:
        return ""
    cleaned = text.strip()
    if len(cleaned) > 10_000:
        cleaned = cleaned[:10_000]
    return cleaned


def _dimension_prompt(
    *,
    dimension: RubricDimension,
    rubric: Rubric,
    task_prompt: str | None,
    final_response: str,
    metrics: dict[str, Any],
    deterministic_triggers: list[str],
) -> str:
    return (
        "Return JSON only with keys: key, score, rationale, failure_modes_matched, confidence.\n"
        f"TARGET_DIMENSION_KEY: {dimension.key}\n"
        f"DIMENSION_ANCHOR: {dimension.anchor}\n"
        f"RUBRIC_FAILURE_MODES: {', '.join(rubric.failure_modes)}\n"
        f"DETERMINISTIC_TRIGGERS: {', '.join(deterministic_triggers)}\n"
        f"OBJECTIVE_METRICS: {metrics}\n"
        f"TASK_PROMPT: {task_prompt or ''}\n"
        f"CANDIDATE_RESPONSE_START\n{final_response}\nCANDIDATE_RESPONSE_END"
    )


def _dimension_repair_prompt(target_key: str, prior_output: str) -> str:
    return (
        "Fix and return valid JSON only with keys key, score, rationale, failure_modes_matched, confidence.\n"
        f"Required key value: {target_key}.\n"
        f"Prior output:\n{prior_output}"
    )


def _holistic_prompt(
    *,
    rubric: Rubric,
    task_prompt: str | None,
    final_response: str,
    metrics: dict[str, Any],
    dimension_scores: dict[str, float],
    deterministic_triggers: list[str],
) -> str:
    return (
        "Return JSON only with keys: overall_score, overall_confidence, consistency_flags, narrative_summary, suggestions.\n"
        f"RUBRIC_DIMENSIONS: {[d.key for d in rubric.dimensions]}\n"
        f"RUBRIC_FAILURE_MODES: {', '.join(rubric.failure_modes)}\n"
        f"DETERMINISTIC_TRIGGERS: {', '.join(deterministic_triggers)}\n"
        f"OBJECTIVE_METRICS: {metrics}\n"
        f"DIMENSION_SCORES: {dimension_scores}\n"
        f"TASK_PROMPT: {task_prompt or ''}\n"
        f"CANDIDATE_RESPONSE_START\n{final_response}\nCANDIDATE_RESPONSE_END"
    )


def _holistic_repair_prompt(prior_output: str) -> str:
    return (
        "Fix and return valid JSON only with keys overall_score, overall_confidence, consistency_flags, narrative_summary, suggestions.\n"
        f"Prior output:\n{prior_output}"
    )


def _parse_dimension_output(payload: str, target_key: str) -> DimensionScoreOutput:
    parsed = DimensionScoreOutput.model_validate_json(payload)
    if parsed.key != target_key:
        raise ValueError("dimension_key_mismatch")
    return DimensionScoreOutput(
        key=parsed.key,
        score=_clamp01(parsed.score),
        rationale=parsed.rationale,
        failure_modes_matched=[str(item) for item in parsed.failure_modes_matched],
        confidence=_clamp01(parsed.confidence),
    )


def _parse_holistic_output(payload: str) -> HolisticScoreOutput:
    parsed = HolisticScoreOutput.model_validate_json(payload)
    return HolisticScoreOutput(
        overall_score=_clamp01(parsed.overall_score),
        overall_confidence=_clamp01(parsed.overall_confidence),
        consistency_flags=[str(item) for item in parsed.consistency_flags],
        narrative_summary=parsed.narrative_summary,
        suggestions=[str(item) for item in parsed.suggestions],
    )


def _dimension_fallback(
    *,
    key: str,
    heuristic_dimension_scores: dict[str, float],
    heuristic_confidence: float,
) -> DimensionScoreOutput:
    return DimensionScoreOutput(
        key=key,
        score=_clamp01(heuristic_dimension_scores.get(key, heuristic_confidence)),
        rationale="heuristic fallback for dimension",
        failure_modes_matched=[],
        confidence=_clamp01(heuristic_confidence),
    )


def _mean_or_zero(values: list[float]) -> float:
    if not values:
        return 0.0
    return _clamp01(mean(values))


def _model_hash_for(provider: EvaluatorProvider | None, traces: list[ModelInvocationTrace]) -> str:
    if provider is None or not traces:
        return "local-baseline"
    last = traces[-1]
    basis = f"{last.provider}:{last.model}"
    return hashlib.sha256(basis.encode("utf-8")).hexdigest()[:16]


def score_session(
    session_id: UUID,
    events: list[dict],
    *,
    rubric: Rubric | None = None,
    task_prompt: str | None = None,
    final_response: str | None = None,
    provider: EvaluatorProvider | None = None,
    scoring_config: ScoringConfig | None = None,
) -> tuple[ScoreResult, Interpretation]:
    metrics = _metric(events)
    heuristic_confidence, heuristic_dimensions, heuristic_trigger_codes, heuristic_trigger_impacts = _heuristic_score(metrics)

    cfg = _effective_scoring_config(scoring_config)
    final_response_clean = _sanitize_final_response(final_response)
    can_use_llm = (
        cfg.enabled
        and provider is not None
        and rubric is not None
        and len(rubric.dimensions) > 0
        and bool(final_response_clean)
    )

    if not can_use_llm:
        needs_review = heuristic_confidence < 0.7 or int(metrics["policy_violation_count"]) > 0
        return (
            ScoreResult(
                session_id=session_id,
                objective_metrics=metrics,
                dimension_scores=heuristic_dimensions,
                confidence=heuristic_confidence,
                needs_human_review=needs_review,
                trigger_codes=heuristic_trigger_codes,
                trigger_impacts=heuristic_trigger_impacts,
                model_hash="local-baseline",
            ),
            _heuristic_interpretation(heuristic_confidence, needs_review),
        )

    assert rubric is not None and provider is not None

    trigger_codes = list(heuristic_trigger_codes)
    trigger_impacts = list(heuristic_trigger_impacts)
    llm_traces: list[ModelInvocationTrace] = []

    deterministic_trigger_codes, deterministic_penalty = _deterministic_rules(metrics, cfg)
    for code in deterministic_trigger_codes:
        _append_trigger(trigger_codes, code)
        _append_trigger_impact(trigger_impacts, code, -0.05)

    call_budget = max(0, int(cfg.llm_call_budget))
    calls_used = 0
    parse_failures = 0
    budget_exceeded = False

    dimension_scores: dict[str, float] = {}
    dimension_evidence: dict[str, DimensionScoreOutput] = {}
    dimension_confidences: list[float] = []

    for dimension in rubric.dimensions:
        if calls_used >= call_budget:
            budget_exceeded = True
            fallback = _dimension_fallback(
                key=dimension.key,
                heuristic_dimension_scores=heuristic_dimensions,
                heuristic_confidence=heuristic_confidence,
            )
            dimension_scores[dimension.key] = fallback.score
            dimension_evidence[dimension.key] = fallback
            dimension_confidences.append(fallback.confidence)
            continue

        prompt = _dimension_prompt(
            dimension=dimension,
            rubric=rubric,
            task_prompt=task_prompt,
            final_response=final_response_clean,
            metrics=metrics,
            deterministic_triggers=deterministic_trigger_codes,
        )

        output = provider.score_dimension(prompt)
        calls_used += 1
        llm_traces.append(
            ModelInvocationTrace(
                provider=output.provider,
                model=output.model,
                prompt_hash=output.prompt_hash,
                latency_ms=output.latency_ms,
            )
        )

        parsed_dimension: DimensionScoreOutput | None = None
        try:
            parsed_dimension = _parse_dimension_output(output.content, dimension.key)
        except (ValidationError, ValueError):
            if calls_used < call_budget:
                repair_prompt = _dimension_repair_prompt(dimension.key, output.content)
                repaired = provider.score_dimension(repair_prompt)
                calls_used += 1
                llm_traces.append(
                    ModelInvocationTrace(
                        provider=repaired.provider,
                        model=repaired.model,
                        prompt_hash=repaired.prompt_hash,
                        latency_ms=repaired.latency_ms,
                    )
                )
                try:
                    parsed_dimension = _parse_dimension_output(repaired.content, dimension.key)
                except (ValidationError, ValueError):
                    parsed_dimension = None

        if parsed_dimension is None:
            parse_failures += 1
            _append_trigger(trigger_codes, f"llm_parse_failure:{dimension.key}")
            fallback = _dimension_fallback(
                key=dimension.key,
                heuristic_dimension_scores=heuristic_dimensions,
                heuristic_confidence=heuristic_confidence,
            )
            dimension_scores[dimension.key] = fallback.score
            dimension_evidence[dimension.key] = fallback
            dimension_confidences.append(fallback.confidence)
            continue

        dimension_scores[dimension.key] = parsed_dimension.score
        dimension_evidence[dimension.key] = parsed_dimension
        dimension_confidences.append(parsed_dimension.confidence)

        for mode in parsed_dimension.failure_modes_matched:
            _append_trigger(trigger_codes, f"failure_mode_match:{mode}")

    holistic: HolisticScoreOutput | None = None
    if calls_used < call_budget:
        holistic_prompt = _holistic_prompt(
            rubric=rubric,
            task_prompt=task_prompt,
            final_response=final_response_clean,
            metrics=metrics,
            dimension_scores=dimension_scores,
            deterministic_triggers=deterministic_trigger_codes,
        )

        holistic_output = provider.score_holistic(holistic_prompt)
        calls_used += 1
        llm_traces.append(
            ModelInvocationTrace(
                provider=holistic_output.provider,
                model=holistic_output.model,
                prompt_hash=holistic_output.prompt_hash,
                latency_ms=holistic_output.latency_ms,
            )
        )
        try:
            holistic = _parse_holistic_output(holistic_output.content)
        except (ValidationError, ValueError):
            holistic = None
            if calls_used < call_budget:
                holistic_repair = provider.score_holistic(_holistic_repair_prompt(holistic_output.content))
                calls_used += 1
                llm_traces.append(
                    ModelInvocationTrace(
                        provider=holistic_repair.provider,
                        model=holistic_repair.model,
                        prompt_hash=holistic_repair.prompt_hash,
                        latency_ms=holistic_repair.latency_ms,
                    )
                )
                try:
                    holistic = _parse_holistic_output(holistic_repair.content)
                except (ValidationError, ValueError):
                    holistic = None

    if holistic is None:
        _append_trigger(trigger_codes, "holistic_parse_failure")

    if calls_used >= call_budget and len(rubric.dimensions) > 0 and calls_used < (len(rubric.dimensions) + 1):
        budget_exceeded = True

    if budget_exceeded:
        _append_trigger(trigger_codes, "llm_budget_exceeded")

    overall_score = holistic.overall_score if holistic is not None else _mean_or_zero(list(dimension_scores.values()))
    confidence = holistic.overall_confidence if holistic is not None else _mean_or_zero(dimension_confidences)

    if holistic is not None and holistic.consistency_flags:
        _append_trigger(trigger_codes, "dimension_holistic_inconsistency")
        _append_trigger_impact(trigger_impacts, "dimension_holistic_inconsistency", -0.1)
        confidence = _clamp01(confidence - 0.1)

    if parse_failures > 0:
        confidence = _clamp01(confidence - 0.05 * parse_failures)

    if deterministic_penalty > 0:
        confidence = _clamp01(confidence - deterministic_penalty)

    if confidence < 0.7:
        _append_trigger(trigger_codes, "low_confidence")
        _append_trigger_impact(trigger_impacts, "low_confidence", confidence - 0.7)

    if int(metrics["policy_violation_count"]) > 0:
        _append_trigger(trigger_codes, "policy_violation")
        _append_trigger_impact(trigger_impacts, "policy_violation", -float(cfg.policy_violation_penalty))

    if int(metrics["verification_steps"]) == 0 and int(metrics["ai_prompt_count"]) > 0:
        _append_trigger(trigger_codes, "high_ai_low_verification")
        _append_trigger_impact(trigger_impacts, "high_ai_low_verification", -0.2)

    needs_review = (
        confidence < 0.7
        or int(metrics["policy_violation_count"]) > 0
        or (holistic is not None and len(holistic.consistency_flags) > 0)
    )

    score_result = ScoreResult(
        session_id=session_id,
        objective_metrics=metrics,
        dimension_scores={k: _clamp01(v) for k, v in dimension_scores.items()},
        dimension_evidence=dimension_evidence,
        confidence=_clamp01(confidence),
        needs_human_review=needs_review,
        scorer_version="0.2.0",
        rubric_version=rubric.version,
        task_family_version="0.1.0",
        model_hash=_model_hash_for(provider, llm_traces),
        llm_traces=llm_traces,
        trigger_codes=trigger_codes,
        trigger_impacts=trigger_impacts,
    )

    if holistic is not None:
        interpretation = Interpretation(
            summary=holistic.narrative_summary,
            suggestions=holistic.suggestions,
        )
    else:
        interpretation = _heuristic_interpretation(_clamp01(overall_score), needs_review)

    return score_result, interpretation
