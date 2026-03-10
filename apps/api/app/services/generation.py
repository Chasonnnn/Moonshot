from __future__ import annotations

from collections import Counter
from typing import Iterable

from app.providers import get_codesign_provider
from app.schemas import GenerationResult, ModelInvocationTrace
from app.schemas.contracts import CaseSpec, Rubric, RubricDimension, TaskFamily, TaskVariant

MIN_VARIANT_JACCARD_DISTANCE = 0.18
DEFAULT_LIVE_VARIANT_COUNT = 12
MIN_VARIANT_COUNT = 5
MAX_VARIANT_COUNT = 20
RUBRIC_LEAKAGE_PHRASES = {
    "correct answer",
    "final answer",
    "exact sql",
    "gold output",
    "hidden rubric",
}


def _normalize_tokens(text: str) -> set[str]:
    tokens = [token.strip(".,:;!?()[]{}\"'").lower() for token in text.split()]
    return {token for token in tokens if token}


def _jaccard_distance(a: str, b: str) -> float:
    ta = _normalize_tokens(a)
    tb = _normalize_tokens(b)
    if not ta and not tb:
        return 0.0
    union = ta | tb
    if not union:
        return 0.0
    overlap = ta & tb
    return 1.0 - (len(overlap) / len(union))


def _assert_variant_diversity(prompts: Iterable[str]) -> None:
    prompt_list = list(prompts)
    for i in range(len(prompt_list)):
        for j in range(i + 1, len(prompt_list)):
            distance = _jaccard_distance(prompt_list[i], prompt_list[j])
            if distance < MIN_VARIANT_JACCARD_DISTANCE:
                raise RuntimeError("variant_diversity_threshold_not_met")


def _rubric_leakage_hits(rubric: Rubric) -> list[str]:
    text_blob = " ".join(
        [*(d.anchor for d in rubric.dimensions), *rubric.failure_modes]
    ).lower()
    hits: list[str] = []
    for phrase in RUBRIC_LEAKAGE_PHRASES:
        if phrase in text_blob:
            hits.append(phrase)
    return sorted(hits)


def _assert_no_rubric_leakage(rubric: Rubric) -> None:
    if _rubric_leakage_hits(rubric):
        raise RuntimeError("rubric_leakage_detected")


def _artifact_summary(case: CaseSpec) -> str:
    artifact_types = Counter(item.get("type", "unknown") for item in case.artifacts)
    if not artifact_types:
        return "artifacts:none"
    return ", ".join(f"{artifact}:{count}" for artifact, count in sorted(artifact_types.items()))


def _grounding_coverage_score(case: CaseSpec, prompts: list[str]) -> float:
    checks: list[bool] = []
    lower_prompts = " ".join(prompts).lower()
    for artifact in case.artifacts:
        artifact_type = str(artifact.get("type", "")).strip().lower()
        if artifact_type:
            checks.append(artifact_type in lower_prompts)
    for tool in case.allowed_tools:
        raw = str(tool).strip().lower()
        spaced = raw.replace("_", " ")
        if raw:
            checks.append(raw in lower_prompts or spaced in lower_prompts)
    if not checks:
        return 1.0
    return round(sum(1 for hit in checks if hit) / len(checks), 3)


def _resolve_variant_count(variant_count: int | None) -> int:
    if variant_count is None:
        return DEFAULT_LIVE_VARIANT_COUNT
    if variant_count < MIN_VARIANT_COUNT or variant_count > MAX_VARIANT_COUNT:
        raise ValueError(f"variant_count_out_of_range:{variant_count}")
    return variant_count


def generate_from_case(
    case: CaseSpec,
    *,
    variant_count: int | None = None,
    model_override: str | None = None,
    reasoning_effort: str | None = None,
    thinking_budget_tokens: int | None = None,
    memory_context: str | None = None,
) -> GenerationResult:
    provider = get_codesign_provider(
        model_override=model_override,
        reasoning_effort=reasoning_effort,
        thinking_budget_tokens=thinking_budget_tokens,
    )
    artifact_summary = _artifact_summary(case)

    resolved_variant_count = _resolve_variant_count(variant_count)
    difficulty_plan = [
        "foundation",
        "foundation",
        "intermediate",
        "intermediate",
        "intermediate",
        "advanced",
        "advanced",
        "advanced",
        "expert",
        "expert",
        "expert",
        "capstone",
    ]
    skill_plan = [
        "sql",
        "python",
        "dashboard",
        "analysis",
        "communication",
        "documentation",
    ]
    objective_plan = [
        "Prioritize anomaly detection and triage order.",
        "Quantify source-versus-dashboard discrepancy with reconciliation checks.",
        "Validate hypotheses with segmented SQL and confidence caveats.",
        "Design a reproducible Python analysis for impact estimation.",
        "Draft a stakeholder-ready narrative with escalation criteria.",
        "Compare at least two counterfactual explanations before choosing one.",
        "Prove data quality assumptions using artifact references.",
        "Translate technical findings into business impact and risk language.",
        "Address ambiguity explicitly with scoped assumptions and checkpoints.",
        "Recommend monitoring metrics and owner handoff details.",
        "Integrate dashboard evidence with SQL/Python traceability.",
        "Deliver a final decision memo with limitations and next actions.",
    ]

    seed_prompt = (
        (f"Retrieved memory context:\n{memory_context[:3000]}\n\n" if memory_context else "")
        + f"Case title: {case.title}\n"
        + f"Scenario: {case.scenario}\n"
        + f"Artifacts: {artifact_summary}\n"
        + f"Allowed tools: {case.allowed_tools}\n"
        + "Return one concise (2-3 sentence) simulation prompt template with no answer leakage."
    )
    seed_output = provider.generate_variant(seed_prompt)
    seed_text = " ".join(seed_output.content.split()).strip()
    if not seed_text:
        raise RuntimeError("provider_seed_prompt_empty")
    seed_theme = " ".join(seed_text.split()[:10]).strip()
    if not seed_theme:
        seed_theme = "Investigate discrepancy with traceable evidence."

    variants: list[TaskVariant] = []
    for idx in range(resolved_variant_count):
        objective = objective_plan[idx % len(objective_plan)]
        skill = skill_plan[idx % len(skill_plan)]
        difficulty_level = difficulty_plan[idx % len(difficulty_plan)]
        round_hint = f"round_{(idx % 3) + 1}"
        prompt = (
            f"Variant {idx + 1}: Theme: {seed_theme}. "
            f"Focus on {skill} ({difficulty_level}, {round_hint}). "
            f"Objective: {objective} "
            f"Use reproducible evidence and avoid answer leakage."
        )
        variants.append(
            TaskVariant(
                prompt=prompt,
                skill=skill,
                difficulty_level=difficulty_level,
                round_hint=round_hint,
                estimated_minutes=12 + (idx % 4) * 4,
                deliverables=[
                    "analysis_summary",
                    "evidence_table",
                    "stakeholder_recommendation",
                ],
                artifact_refs=[
                    "orders.csv",
                    "dashboard_snapshot.png",
                    "pipeline_log.txt",
                ],
            )
        )

    rubric = Rubric(
        dimensions=[
            RubricDimension(key="problem_framing", anchor="Frames assumptions, scope, and constraints clearly."),
            RubricDimension(key="sql_quality", anchor="Builds correct and iterative SQL reasoning with checks."),
            RubricDimension(key="evidence_reasoning", anchor="Uses evidence quality and caveats before conclusions."),
            RubricDimension(key="communication", anchor="Communicates risk, escalation, and next steps clearly."),
        ],
        failure_modes=[
            "Jumps to conclusions without validation.",
            "Provides unverifiable claims.",
            "Ignores uncertainty and escalation triggers.",
        ],
    )

    _assert_variant_diversity([variant.prompt for variant in variants])
    _assert_no_rubric_leakage(rubric)

    leakage_rule_hits = _rubric_leakage_hits(rubric)
    grounding_coverage_score = _grounding_coverage_score(case, [variant.prompt for variant in variants])

    task_family = TaskFamily(
        case_id=case.id,
        variants=variants,
        rubric_id=rubric.id,
        generation_diagnostics={
            "diversity_passed": True,
            "diversity_fail_reason": None,
            "rubric_leakage_detected": len(leakage_rule_hits) > 0,
            "leakage_rule_hits": leakage_rule_hits,
            "grounding_coverage_score": grounding_coverage_score,
        },
    )

    trace = ModelInvocationTrace(
        provider=seed_output.provider,
        model=seed_output.model,
        prompt_hash=seed_output.prompt_hash,
        latency_ms=seed_output.latency_ms,
    )

    return GenerationResult(task_family=task_family, rubric=rubric, model_trace=trace)
