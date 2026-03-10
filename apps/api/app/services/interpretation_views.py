from __future__ import annotations

from uuid import UUID

from app.schemas import InterpretationRequest, InterpretationView, ScoringVersionLock
from app.services.memory import sync_interpretation_view_memory
from app.services.repositories import scoring_repository
from app.services.store import store


def create_interpretation_view(session_id: UUID, request: InterpretationRequest, *, tenant_id: str) -> InterpretationView:
    report = scoring_repository.get_report(session_id)
    if report is None:
        raise RuntimeError("report_not_found")

    score = report.score_result
    selected_dimensions = request.focus_dimensions or list(score.dimension_scores.keys())
    breakdown = {
        "dimension_scores": {key: score.dimension_scores.get(key) for key in selected_dimensions},
        "objective_metrics": score.objective_metrics,
    }

    if request.include_sensitivity:
        weighted = {
            key: round(float(score.dimension_scores.get(key, 0.0)) * float(request.weight_overrides.get(key, 1.0)), 3)
            for key in selected_dimensions
        }
        breakdown["sensitivity_analysis"] = {
            "weighted_dimensions": weighted,
            "note": "Interpretive-only analysis. Scores are unchanged.",
        }

    scoring_lock = ScoringVersionLock(
        scorer_version=score.scorer_version,
        rubric_version=score.rubric_version,
        task_family_version=score.task_family_version,
        model_hash=score.model_hash,
    )

    view = InterpretationView(
        session_id=session_id,
        focus_dimensions=selected_dimensions,
        include_sensitivity=request.include_sensitivity,
        weight_overrides=request.weight_overrides,
        breakdown=breakdown,
        caveats=[
            "Interpretation views do not mutate scoring outputs.",
            "Use scoring_version_lock to validate stable scoring provenance.",
        ],
        scoring_version_lock=scoring_lock,
    )
    store.interpretation_views[view.view_id] = {
        "session_id": str(view.session_id),
        "tenant_id": tenant_id,
        "payload": view.model_dump(mode="json"),
        "created_at": view.created_at.isoformat(),
    }
    sync_interpretation_view_memory(view, tenant_id=tenant_id)
    return view


def get_interpretation_view(session_id: UUID, view_id: UUID) -> InterpretationView | None:
    payload = store.interpretation_views.get(view_id)
    if payload is None:
        return None
    view_payload = payload.get("payload")
    if not isinstance(view_payload, dict):
        return None
    view = InterpretationView.model_validate(view_payload)
    if view.session_id != session_id:
        return None
    return view
