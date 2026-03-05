from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import (
    HumanReviewRecord,
    HumanReviewUpdateRequest,
    InterpretationRequest,
    InterpretationView,
    JobAccepted,
    Report,
    ReportSummary,
    ScoringVersionLock,
)
from app.services.audit import audit
from app.services.interpretation_views import get_interpretation_view
from app.services.jobs import submit_job
from app.services.repositories import scoring_repository, session_repository
from app.services.store import store

router = APIRouter(prefix="/v1/reports", tags=["reports"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _get_human_review_record(session_id: UUID) -> HumanReviewRecord | None:
    payload = store.human_reviews.get(session_id)
    if payload is None:
        return None
    return HumanReviewRecord.model_validate(payload)


@router.get("/{session_id}", response_model=Report)
def get_report(
    session_id: UUID,
    user: UserContext = Depends(require_roles("reviewer", "org_admin")),
) -> Report:
    existing = scoring_repository.get_report(session_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Report not found")
    session = session_repository.get_session(session_id)
    if session is None or session.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Report not found")
    audit(user, "read", "report", str(session_id))
    return existing


@router.get("/{session_id}/summary", response_model=ReportSummary)
def get_report_summary(
    session_id: UUID,
    user: UserContext = Depends(require_roles("reviewer", "org_admin")),
) -> ReportSummary:
    session = session_repository.get_session(session_id)
    if session is None or session.tenant_id != user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    human_review = _get_human_review_record(session_id)
    has_human_review = human_review is not None

    report = scoring_repository.get_report(session_id)
    if report is None:
        audit(user, "read", "report_summary", str(session_id), {"report_available": False})
        return ReportSummary(
            session_id=session_id,
            session_status=session.status,
            report_available=False,
            confidence=None,
            needs_human_review=None,
            trigger_codes=[],
            trigger_count=0,
            last_scored_at=None,
            scoring_version_lock=None,
            has_human_review=has_human_review,
            final_score_source=None,
            final_confidence=None,
        )

    score = report.score_result
    override_applied = has_human_review and human_review.override_overall_score is not None
    final_confidence = (
        human_review.override_confidence
        if override_applied and human_review.override_confidence is not None
        else score.confidence
    )
    summary = ReportSummary(
        session_id=session_id,
        session_status=session.status,
        report_available=True,
        confidence=score.confidence,
        needs_human_review=score.needs_human_review,
        trigger_codes=score.trigger_codes,
        trigger_count=len(score.trigger_codes),
        last_scored_at=score.scored_at,
        scoring_version_lock=ScoringVersionLock(
            scorer_version=score.scorer_version,
            rubric_version=score.rubric_version,
            task_family_version=score.task_family_version,
            model_hash=score.model_hash,
        ),
        has_human_review=has_human_review,
        final_score_source="human_override" if override_applied else "model",
        final_confidence=final_confidence,
    )
    audit(user, "read", "report_summary", str(session_id), {"report_available": True})
    return summary


@router.get("/{session_id}/human-review", response_model=HumanReviewRecord)
def get_human_review(
    session_id: UUID,
    user: UserContext = Depends(require_roles("reviewer", "org_admin")),
) -> HumanReviewRecord:
    session = session_repository.get_session(session_id)
    if session is None or session.tenant_id != user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    existing = _get_human_review_record(session_id)
    if existing is not None:
        audit(user, "read", "human_review", str(session_id), {"exists": True})
        return existing

    now = _now()
    payload = HumanReviewRecord(
        session_id=session_id,
        tenant_id=user.tenant_id,
        notes_markdown=None,
        tags=[],
        override_overall_score=None,
        override_confidence=None,
        dimension_overrides={},
        reviewer_id=None,
        created_at=now,
        updated_at=now,
    )
    audit(user, "read", "human_review", str(session_id), {"exists": False})
    return payload


@router.put("/{session_id}/human-review", response_model=HumanReviewRecord)
def put_human_review(
    session_id: UUID,
    payload: HumanReviewUpdateRequest,
    user: UserContext = Depends(require_roles("reviewer", "org_admin")),
) -> HumanReviewRecord:
    session = session_repository.get_session(session_id)
    if session is None or session.tenant_id != user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    now = _now()
    existing = _get_human_review_record(session_id)
    created_at = existing.created_at if existing is not None else now

    dimension_overrides = (
        {key: float(value) for key, value in payload.dimension_overrides.items()}
        if isinstance(payload.dimension_overrides, dict)
        else (existing.dimension_overrides if existing is not None else {})
    )
    row = HumanReviewRecord(
        session_id=session_id,
        tenant_id=user.tenant_id,
        notes_markdown=payload.notes_markdown if payload.notes_markdown is not None else (existing.notes_markdown if existing is not None else None),
        tags=payload.tags if payload.tags is not None else (existing.tags if existing is not None else []),
        override_overall_score=(
            payload.override_overall_score
            if payload.override_overall_score is not None
            else (existing.override_overall_score if existing is not None else None)
        ),
        override_confidence=(
            payload.override_confidence
            if payload.override_confidence is not None
            else (existing.override_confidence if existing is not None else None)
        ),
        dimension_overrides=dimension_overrides,
        reviewer_id=user.user_id,
        created_at=created_at,
        updated_at=now,
    )
    store.human_reviews[session_id] = row.model_dump(mode="json")
    audit(
        user,
        "update",
        "human_review",
        str(session_id),
        {
            "override_overall_score": row.override_overall_score,
            "override_confidence": row.override_confidence,
            "tags_count": len(row.tags),
        },
    )
    return row


@router.post("/{session_id}/interpret", response_model=JobAccepted, status_code=status.HTTP_202_ACCEPTED)
def create_interpretation(
    session_id: UUID,
    payload: InterpretationRequest,
    user: UserContext = Depends(require_roles("reviewer", "org_admin")),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> JobAccepted:
    if idempotency_key is None or not idempotency_key.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing Idempotency-Key header")

    session = session_repository.get_session(session_id)
    if session is None or session.tenant_id != user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    if scoring_repository.get_report(session_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    accepted = submit_job(
        job_type="interpretation_generate",
        target_type="session",
        target_id=session_id,
        user=user,
        request_payload={"session_id": str(session_id), "interpretation_request": payload.model_dump(mode="json")},
        idempotency_key=idempotency_key,
    )
    audit(user, "submit_job", "report_interpret", str(session_id), {"job_id": str(accepted.job_id)})
    return accepted


@router.get("/{session_id}/interpretations/{view_id}", response_model=InterpretationView)
def get_interpretation(
    session_id: UUID,
    view_id: UUID,
    user: UserContext = Depends(require_roles("reviewer", "org_admin")),
) -> InterpretationView:
    session = session_repository.get_session(session_id)
    if session is None or session.tenant_id != user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interpretation view not found")
    view = get_interpretation_view(session_id, view_id)
    if view is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interpretation view not found")
    return view
