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


def _assert_no_rubric_leakage(rubric: Rubric) -> None:
    text_blob = " ".join(
        [*(d.anchor for d in rubric.dimensions), *rubric.failure_modes]
    ).lower()
    for phrase in RUBRIC_LEAKAGE_PHRASES:
        if phrase in text_blob:
            raise RuntimeError("rubric_leakage_detected")


def _artifact_summary(case: CaseSpec) -> str:
    artifact_types = Counter(item.get("type", "unknown") for item in case.artifacts)
    if not artifact_types:
        return "artifacts:none"
    return ", ".join(f"{artifact}:{count}" for artifact, count in sorted(artifact_types.items()))


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

    task_family = TaskFamily(case_id=case.id, variants=variants, rubric_id=rubric.id)

    trace = ModelInvocationTrace(
        provider=rubric_output.provider,
        model=rubric_output.model,
        prompt_hash=rubric_output.prompt_hash,
        latency_ms=rubric_output.latency_ms,
    )

    return GenerationResult(task_family=task_family, rubric=rubric, model_trace=trace)
