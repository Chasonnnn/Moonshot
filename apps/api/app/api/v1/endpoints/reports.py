from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import InterpretationRequest, InterpretationView, JobAccepted, Report, ReportSummary, ScoringVersionLock
from app.services.audit import audit
from app.services.interpretation_views import get_interpretation_view
from app.services.jobs import submit_job
from app.services.repositories import scoring_repository, session_repository

router = APIRouter(prefix="/v1/reports", tags=["reports"])


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
        )

    score = report.score_result
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
    )
    audit(user, "read", "report_summary", str(session_id), {"report_available": True})
    return summary


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
