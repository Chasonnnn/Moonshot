from __future__ import annotations

from app.schemas import GenerationResult
from app.schemas.contracts import CaseSpec, Rubric, RubricDimension, TaskFamily, TaskVariant


def generate_from_case(case: CaseSpec) -> GenerationResult:
    variants = [
        TaskVariant(prompt=f"Variant A: {case.scenario} Focus on anomaly detection."),
        TaskVariant(prompt=f"Variant B: {case.scenario} Focus on root-cause validation."),
        TaskVariant(prompt=f"Variant C: {case.scenario} Focus on stakeholder communication."),
    ]
    rubric = Rubric(
        dimensions=[
            RubricDimension(key="problem_framing", anchor="Frames assumptions and objectives clearly."),
            RubricDimension(key="sql_quality", anchor="Builds correct and iterative SQL reasoning."),
            RubricDimension(key="evidence_reasoning", anchor="Uses evidence to support conclusions."),
            RubricDimension(key="communication", anchor="Communicates risks, caveats, and next steps."),
        ],
        failure_modes=[
            "Jumps to conclusions without checking data quality.",
            "Provides unverifiable claims.",
            "Ignores uncertainty and escalation triggers.",
        ],
    )
    task_family = TaskFamily(case_id=case.id, variants=variants, rubric_id=rubric.id)
    return GenerationResult(task_family=task_family, rubric=rubric)
