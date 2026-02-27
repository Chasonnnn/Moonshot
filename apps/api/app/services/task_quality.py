from __future__ import annotations

from collections.abc import Iterable
from typing import Any
from uuid import UUID

from app.schemas import TaskQualitySignal
from app.services.repositories import case_repository
from app.services.store import store

RUBRIC_LEAKAGE_PHRASES = {"correct answer", "gold output", "hidden rubric", "exact sql", "final answer"}


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
    return 1.0 - (len(ta & tb) / len(union))


def _mean_pairwise_distance(prompts: Iterable[str]) -> float:
    values = list(prompts)
    if len(values) < 2:
        return 0.0
    distances: list[float] = []
    for i in range(len(values)):
        for j in range(i + 1, len(values)):
            distances.append(_jaccard_distance(values[i], values[j]))
    if not distances:
        return 0.0
    return sum(distances) / len(distances)


def _has_rubric_leakage(rubric_payload: dict[str, Any]) -> bool:
    dimensions = rubric_payload.get("dimensions", [])
    failure_modes = rubric_payload.get("failure_modes", [])
    text_parts: list[str] = []
    for item in dimensions:
        if isinstance(item, dict):
            text_parts.append(str(item.get("anchor", "")))
    text_parts.extend(str(item) for item in failure_modes)
    blob = " ".join(text_parts).lower()
    return any(phrase in blob for phrase in RUBRIC_LEAKAGE_PHRASES)


def evaluate_task_quality(task_family_id: UUID, *, evaluated_by_role: str) -> TaskQualitySignal:
    task_family = case_repository.get_task_family(task_family_id)
    if task_family is None:
        raise RuntimeError("task_family_not_found")

    case_payload = case_repository.get_case(task_family.case_id)
    if case_payload is None:
        raise RuntimeError("case_not_found")
    rubric = case_repository.get_rubric(task_family.rubric_id)
    if rubric is None:
        raise RuntimeError("rubric_not_found")

    prompts = [variant.prompt for variant in task_family.variants]
    variant_count = len(prompts)
    diversity_score = round(max(0.0, min(1.0, _mean_pairwise_distance(prompts))), 3)
    clarity_score = round(max(0.0, min(1.0, 1.0 - abs(120.0 - (sum(len(x) for x in prompts) / max(1, variant_count))) / 240.0)), 3)
    realism_score = round(min(1.0, 0.4 + (0.2 * len(case_payload.artifacts)) + (0.1 * len(case_payload.allowed_tools))), 3)
    variant_stability_score = round(max(0.0, min(1.0, 0.55 + diversity_score * 0.35)), 3)
    admin_acceptance_rate = 1.0 if task_family.status in {"approved", "published"} else 0.0
    mean_edit_distance = 0.0
    rubric_leakage_detected = _has_rubric_leakage(rubric.model_dump(mode="json"))

    quality_score = round(
        max(
            0.0,
            min(
                1.0,
                (0.25 * diversity_score)
                + (0.2 * clarity_score)
                + (0.2 * realism_score)
                + (0.2 * variant_stability_score)
                + (0.15 * admin_acceptance_rate)
                - (0.3 if rubric_leakage_detected else 0.0),
            ),
        ),
        3,
    )

    signal = TaskQualitySignal(
        task_family_id=task_family_id,
        variant_count=variant_count,
        diversity_score=diversity_score,
        clarity_score=clarity_score,
        realism_score=realism_score,
        variant_stability_score=variant_stability_score,
        admin_acceptance_rate=admin_acceptance_rate,
        mean_edit_distance=mean_edit_distance,
        rubric_leakage_detected=rubric_leakage_detected,
        quality_score=quality_score,
        evaluated_by_role=evaluated_by_role,
    )
    store.task_quality_signals[task_family_id] = signal.model_dump(mode="json")
    return signal


def get_task_quality(task_family_id: UUID) -> TaskQualitySignal | None:
    payload = store.task_quality_signals.get(task_family_id)
    if payload is None:
        return None
    return TaskQualitySignal.model_validate(payload)
