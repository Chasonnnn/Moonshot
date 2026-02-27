from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from uuid import uuid4

from app.services.scoring import score_session


def _normalized_trigger_codes(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    return sorted({str(item) for item in raw})


def _normalized_trigger_impacts(raw: Any) -> list[tuple[str, float]]:
    if not isinstance(raw, list):
        return []
    normalized: list[tuple[str, float]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        code = str(item.get("code", "")).strip()
        if not code:
            continue
        try:
            delta = round(float(item.get("delta", 0.0)), 3)
        except (TypeError, ValueError):
            continue
        normalized.append((code, delta))
    return sorted(normalized)


def evaluate_drift(
    baseline: dict[str, dict[str, Any]],
    current: dict[str, dict[str, Any]],
    *,
    confidence_delta_max: float,
    dimension_delta_max: float,
) -> dict[str, Any]:
    drifts: list[dict[str, Any]] = []
    checked_cases = 0
    trigger_mismatch_count = 0
    trigger_impact_mismatch_count = 0

    for case_id, baseline_case in baseline.items():
        current_case = current.get(case_id)
        if current_case is None:
            drifts.append({"case_id": case_id, "reason": "missing_current_case"})
            continue
        checked_cases += 1

        confidence_delta = abs(float(baseline_case["confidence"]) - float(current_case["confidence"]))
        if confidence_delta > confidence_delta_max:
            drifts.append(
                {
                    "case_id": case_id,
                    "reason": "confidence_delta_exceeded",
                    "delta": round(confidence_delta, 6),
                    "limit": confidence_delta_max,
                }
            )

        baseline_dims = baseline_case.get("dimension_scores", {})
        current_dims = current_case.get("dimension_scores", {})
        for key, baseline_value in baseline_dims.items():
            if key not in current_dims:
                drifts.append({"case_id": case_id, "reason": "missing_dimension", "dimension": key})
                continue
            dimension_delta = abs(float(baseline_value) - float(current_dims[key]))
            if dimension_delta > dimension_delta_max:
                drifts.append(
                    {
                        "case_id": case_id,
                        "reason": "dimension_delta_exceeded",
                        "dimension": key,
                        "delta": round(dimension_delta, 6),
                        "limit": dimension_delta_max,
                    }
                )

        if "trigger_codes" in baseline_case:
            expected_trigger_codes = _normalized_trigger_codes(baseline_case.get("trigger_codes"))
            current_trigger_codes = _normalized_trigger_codes(current_case.get("trigger_codes"))
            if expected_trigger_codes != current_trigger_codes:
                trigger_mismatch_count += 1
                drifts.append(
                    {
                        "case_id": case_id,
                        "reason": "trigger_code_mismatch",
                        "expected_trigger_codes": expected_trigger_codes,
                        "current_trigger_codes": current_trigger_codes,
                    }
                )
        if "trigger_impacts" in baseline_case:
            expected_impacts = _normalized_trigger_impacts(baseline_case.get("trigger_impacts"))
            current_impacts = _normalized_trigger_impacts(current_case.get("trigger_impacts"))
            if expected_impacts != current_impacts:
                trigger_impact_mismatch_count += 1
                drifts.append(
                    {
                        "case_id": case_id,
                        "reason": "trigger_impact_mismatch",
                        "expected_trigger_impacts": expected_impacts,
                        "current_trigger_impacts": current_impacts,
                    }
                )

    return {
        "pass": len(drifts) == 0,
        "checked_cases": checked_cases,
        "drift_count": len(drifts),
        "trigger_mismatch_count": trigger_mismatch_count,
        "trigger_impact_mismatch_count": trigger_impact_mismatch_count,
        "drifts": drifts,
    }


def run_benchmark_fixture(path: str | Path) -> dict[str, Any]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    baseline = payload.get("baseline", {})
    thresholds = payload.get("thresholds", {})
    cases = payload.get("cases", {})

    current: dict[str, dict[str, Any]] = {}
    for case_id, case_payload in cases.items():
        events = case_payload.get("events", [])
        score_result, _ = score_session(uuid4(), events)
        current[case_id] = {
            "confidence": score_result.confidence,
            "dimension_scores": score_result.dimension_scores,
            "trigger_codes": score_result.trigger_codes,
            "trigger_impacts": score_result.trigger_impacts,
        }

    return evaluate_drift(
        baseline,
        current,
        confidence_delta_max=float(thresholds.get("confidence_delta_max", 0.05)),
        dimension_delta_max=float(thresholds.get("dimension_delta_max", 0.08)),
    )
