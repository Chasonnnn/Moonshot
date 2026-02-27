from __future__ import annotations

from collections import Counter
from typing import Iterable

from app.providers import get_codesign_provider
from app.schemas import GenerationResult, ModelInvocationTrace
from app.schemas.contracts import CaseSpec, Rubric, RubricDimension, TaskFamily, TaskVariant

MIN_VARIANT_JACCARD_DISTANCE = 0.18
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


def generate_from_case(case: CaseSpec) -> GenerationResult:
    provider = get_codesign_provider()
    artifact_summary = _artifact_summary(case)

    variant_seeds = [
        "Prioritize anomaly detection and triage order.",
        "Focus on root-cause validation and uncertainty tracking.",
        "Focus on stakeholder communication and escalation rationale.",
    ]

    variant_outputs = []
    for idx, seed in enumerate(variant_seeds, start=1):
        prompt = (
            f"Case title: {case.title}\n"
            f"Scenario: {case.scenario}\n"
            f"Artifacts: {artifact_summary}\n"
            f"Allowed tools: {case.allowed_tools}\n"
            f"Constraints: {case.constraints if hasattr(case, 'constraints') else {}}\n"
            f"Variant objective: {seed}\n"
            f"Return one safe simulation task prompt."
        )
        output = provider.generate_variant(prompt)
        variant_outputs.append(output)

    variants = [TaskVariant(prompt=f"Variant {chr(64 + i)}: {out.content}") for i, out in enumerate(variant_outputs, start=1)]

    rubric_prompt = (
        f"Scenario: {case.scenario}\n"
        f"Required dimensions: problem_framing, sql_quality, evidence_reasoning, communication\n"
        "Provide anchor descriptions and failure modes without revealing answer keys."
    )
    rubric_output = provider.generate_rubric(rubric_prompt)

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
        provider=rubric_output.provider,
        model=rubric_output.model,
        prompt_hash=rubric_output.prompt_hash,
        latency_ms=rubric_output.latency_ms,
    )

    return GenerationResult(task_family=task_family, rubric=rubric, model_trace=trace)
