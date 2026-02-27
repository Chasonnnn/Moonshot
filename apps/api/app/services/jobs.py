from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import and_, or_, select, update

from app.core.config import get_settings
from app.core.security import UserContext
from app.db.session import SessionLocal
from app.models.entities import JobAttemptModel, JobRunModel
from app.schemas import AuditLog, JobAccepted, JobResultResponse, JobStatus, Report, ReviewQueueItem, Session
from app.services.exporting import build_export
from app.services.generation import generate_from_case
from app.services.idempotency import get_cached, set_cached
from app.services.redteam import run_redteam
from app.services.repositories import (
    case_repository,
    governance_repository,
    scoring_repository,
    session_repository,
)
from app.services.scoring import score_session
from app.services.store import store


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _status_progress(status: str) -> int:
    if status == "completed":
        return 100
    if status == "running":
        return 50
    if status == "failed_permanent":
        return 100
    if status == "retrying":
        return 25
    return 0


def _ready_job_clause(now: datetime):
    return or_(
        JobRunModel.status == "pending",
        and_(
            JobRunModel.status == "retrying",
            JobRunModel.next_attempt_at.is_not(None),
            JobRunModel.next_attempt_at <= now,
        ),
        and_(
            JobRunModel.status == "running",
            JobRunModel.lease_expires_at.is_not(None),
            JobRunModel.lease_expires_at <= now,
        ),
    )


def _classify_error(exc: Exception) -> str:
    if isinstance(exc, TimeoutError):
        return "provider_timeout"
    if isinstance(exc, PermissionError):
        return "policy_violation"
    if isinstance(exc, ValueError):
        return "validation_error"

    message = str(exc).lower()
    if "not_found" in message or "not_submitted" in message or "unsupported_job_type" in message:
        return "validation_error"
    if "service unavailable" in message or "connection" in message or "dependency" in message:
        return "dependency_unavailable"
    return "internal_error"


def submit_job(
    *,
    job_type: str,
    target_type: str,
    target_id: UUID,
    user: UserContext,
    request_payload: dict[str, Any],
    idempotency_key: str,
) -> JobAccepted:
    cache_scope = f"{user.tenant_id}:{job_type}"
    cached = get_cached(cache_scope, idempotency_key)
    if cached is not None:
        return JobAccepted.model_validate(cached)

    now = _now()
    job_id = uuid4()
    max_attempts = get_settings().worker_max_attempts_default

    with SessionLocal() as db:
        db.add(
            JobRunModel(
                id=str(job_id),
                tenant_id=user.tenant_id,
                created_by=user.user_id,
                job_type=job_type,
                target_type=target_type,
                target_id=str(target_id),
                status="pending",
                request_payload=request_payload,
                result_payload=None,
                error_code=None,
                error_detail=None,
                attempt_count=0,
                max_attempts=max_attempts,
                idempotency_scope=cache_scope,
                idempotency_key=idempotency_key,
                created_at=now,
                updated_at=now,
                started_at=None,
                completed_at=None,
                next_attempt_at=now,
                lease_owner=None,
                lease_expires_at=None,
            )
        )
        db.commit()

    accepted = JobAccepted(job_id=job_id, status="pending", submitted_at=now)
    set_cached(cache_scope, idempotency_key, accepted.model_dump(mode="json"))
    return accepted


def get_job_status(job_id: UUID, tenant_id: str) -> JobStatus | None:
    with SessionLocal() as db:
        row = db.get(JobRunModel, str(job_id))
        if row is None or row.tenant_id != tenant_id:
            return None
        return JobStatus(
            job_id=UUID(row.id),
            status=row.status,
            job_type=row.job_type,
            target_type=row.target_type,
            target_id=row.target_id,
            progress=_status_progress(row.status),
            error_code=row.error_code,
            error_detail=row.error_detail,
            submitted_at=row.created_at,
            started_at=row.started_at,
            completed_at=row.completed_at,
            next_attempt_at=row.next_attempt_at,
            lease_owner=row.lease_owner,
            lease_expires_at=row.lease_expires_at,
        )


def get_jobs_for_tenant(
    tenant_id: str,
    *,
    status: str | None = None,
    job_type: str | None = None,
    limit: int = 100,
) -> list[JobStatus]:
    with SessionLocal() as db:
        query = select(JobRunModel).where(JobRunModel.tenant_id == tenant_id)
        if status is not None:
            query = query.where(JobRunModel.status == status)
        if job_type is not None:
            query = query.where(JobRunModel.job_type == job_type)
        rows = db.execute(query.order_by(JobRunModel.created_at.desc()).limit(limit)).scalars().all()

    return [
        JobStatus(
            job_id=UUID(row.id),
            status=row.status,
            job_type=row.job_type,
            target_type=row.target_type,
            target_id=row.target_id,
            progress=_status_progress(row.status),
            error_code=row.error_code,
            error_detail=row.error_detail,
            submitted_at=row.created_at,
            started_at=row.started_at,
            completed_at=row.completed_at,
            next_attempt_at=row.next_attempt_at,
            lease_owner=row.lease_owner,
            lease_expires_at=row.lease_expires_at,
        )
        for row in rows
    ]


def get_job_result(job_id: UUID, tenant_id: str) -> JobResultResponse | None:
    with SessionLocal() as db:
        row = db.get(JobRunModel, str(job_id))
        if row is None or row.tenant_id != tenant_id:
            return None
        if row.result_payload is None:
            result_payload = {}
            if row.error_code or row.error_detail:
                result_payload = {
                    "error_code": row.error_code,
                    "error_detail": row.error_detail,
                }
            return JobResultResponse(job_id=UUID(row.id), status=row.status, result=result_payload)
        return JobResultResponse(job_id=UUID(row.id), status=row.status, result=row.result_payload)


def _audit_system(tenant_id: str, action: str, resource_type: str, resource_id: str, metadata: dict[str, Any] | None = None):
    entry = AuditLog(
        tenant_id=tenant_id,
        actor_role="system",
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        metadata=metadata or {},
    )
    governance_repository.append_audit_log(entry.model_dump(mode="json"))


def _handle_generate_case(job: JobRunModel) -> dict[str, Any]:
    case_id = UUID(job.request_payload["case_id"])
    case = case_repository.get_case(case_id)
    if case is None:
        raise RuntimeError("case_not_found")

    generated = generate_from_case(case)
    case_repository.save_task_family(generated.task_family)
    case_repository.save_rubric(generated.rubric)

    _audit_system(job.tenant_id, "generate", "case", str(case_id), {"task_family_id": str(generated.task_family.id)})
    return generated.model_dump(mode="json")


def _handle_score_session(job: JobRunModel) -> dict[str, Any]:
    session_id = UUID(job.request_payload["session_id"])
    session = session_repository.get_session(session_id)
    if session is None:
        raise RuntimeError("session_not_found")
    if session.status != "submitted":
        raise RuntimeError("session_not_submitted")

    events = session_repository.list_events(session_id)
    score_result, interpretation = score_session(session_id, events)
    scoring_repository.save_score(score_result)
    report = Report(session_id=session_id, score_result=score_result, interpretation=interpretation)
    scoring_repository.save_report(report)

    if score_result.needs_human_review:
        review_item = ReviewQueueItem(
            session_id=session_id,
            tenant_id=job.tenant_id,
            reason="score_flagged_for_human_review",
            created_by=job.created_by,
            created_at=_now(),
            updated_at=_now(),
        )
        scoring_repository.save_review_item(review_item)

    updated_session = Session.model_validate({**session.model_dump(mode="json"), "status": "scored"})
    session_repository.save_session(updated_session)

    _audit_system(job.tenant_id, "score", "session", str(session_id))
    return score_result.model_dump(mode="json")


def _handle_export_session(job: JobRunModel) -> dict[str, Any]:
    session_id = UUID(job.request_payload["session_id"])
    session = session_repository.get_session(session_id)
    if session is None:
        raise RuntimeError("session_not_found")
    if session.tenant_id != job.tenant_id:
        raise RuntimeError("session_not_found")

    report = scoring_repository.get_report(session_id)
    if report is None:
        raise RuntimeError("report_not_found")

    run_id = uuid4()
    scoring_repository.save_export_run(run_id, session_id)
    bundle = build_export(run_id, report)
    _audit_system(job.tenant_id, "export", "session", str(session_id), {"run_id": str(run_id)})
    return bundle.model_dump(mode="json", by_alias=True)


def _handle_redteam(job: JobRunModel) -> dict[str, Any]:
    target_type = str(job.request_payload["target_type"])
    target_id = UUID(job.request_payload["target_id"])
    result = run_redteam(target_type, target_id)
    store.redteam_runs[result.id] = result.model_dump(mode="json")
    _audit_system(job.tenant_id, "run", "redteam", str(result.id), {"target_type": target_type, "target_id": str(target_id)})
    return result.model_dump(mode="json")


def _execute_job(job: JobRunModel) -> dict[str, Any]:
    if job.job_type == "generate":
        return _handle_generate_case(job)
    if job.job_type == "score":
        return _handle_score_session(job)
    if job.job_type == "redteam":
        return _handle_redteam(job)
    if job.job_type == "export":
        return _handle_export_session(job)
    raise RuntimeError("unsupported_job_type")


def _claim_next_job(*, worker_id: str, now: datetime) -> tuple[str, str] | None:
    lease_seconds = float(get_settings().worker_lease_seconds)
    lease_expires_at = now + timedelta(seconds=lease_seconds)

    for _ in range(8):
        with SessionLocal() as db:
            candidate = (
                db.execute(
                    select(JobRunModel.id, JobRunModel.status, JobRunModel.attempt_count)
                    .where(_ready_job_clause(now))
                    .where(
                        or_(
                            JobRunModel.lease_owner.is_(None),
                            JobRunModel.lease_expires_at.is_(None),
                            JobRunModel.lease_expires_at <= now,
                        )
                    )
                    .order_by(JobRunModel.created_at.asc())
                    .limit(1)
                )
                .first()
            )
            if candidate is None:
                return None

            next_attempt_no = int(candidate.attempt_count) + 1
            updated = db.execute(
                update(JobRunModel)
                .where(JobRunModel.id == candidate.id)
                .where(JobRunModel.status == candidate.status)
                .where(JobRunModel.attempt_count == candidate.attempt_count)
                .where(
                    or_(
                        JobRunModel.lease_owner.is_(None),
                        JobRunModel.lease_expires_at.is_(None),
                        JobRunModel.lease_expires_at <= now,
                    )
                )
                .values(
                    attempt_count=next_attempt_no,
                    status="running",
                    started_at=now,
                    updated_at=now,
                    next_attempt_at=None,
                    lease_owner=worker_id,
                    lease_expires_at=lease_expires_at,
                )
            )
            if updated.rowcount != 1:
                db.rollback()
                continue

            attempt_id = str(uuid4())
            db.add(
                JobAttemptModel(
                    id=attempt_id,
                    job_id=str(candidate.id),
                    attempt_no=next_attempt_no,
                    status="running",
                    error_code=None,
                    error_detail=None,
                    started_at=now,
                    completed_at=None,
                )
            )
            db.commit()
            return str(candidate.id), attempt_id
    return None


def process_jobs_once(*, worker_id: str = "worker-main") -> bool:
    now = _now()
    claim = _claim_next_job(worker_id=worker_id, now=now)
    if claim is None:
        return False
    job_id, attempt_id = claim

    with SessionLocal() as db:
        job = db.get(JobRunModel, job_id)
        attempt = db.get(JobAttemptModel, attempt_id)
        assert job is not None and attempt is not None

        try:
            result = _execute_job(job)
            completed = _now()
            job.status = "completed"
            job.result_payload = result
            job.error_code = None
            job.error_detail = None
            job.completed_at = completed
            job.updated_at = completed
            job.lease_owner = None
            job.lease_expires_at = None

            attempt.status = "completed"
            attempt.completed_at = completed
            db.commit()
            return True
        except Exception as exc:
            completed = _now()
            error_code = _classify_error(exc)
            error_detail = str(exc)

            if int(job.attempt_count) >= int(job.max_attempts):
                job.status = "failed_permanent"
                job.completed_at = completed
                job.next_attempt_at = None
            else:
                job.status = "retrying"
                settings = get_settings()
                retry_delay_seconds = float(settings.worker_retry_base_seconds) * (2 ** (int(job.attempt_count) - 1))
                job.next_attempt_at = completed + timedelta(seconds=retry_delay_seconds)

            job.error_code = error_code
            job.error_detail = error_detail
            job.updated_at = completed
            job.lease_owner = None
            job.lease_expires_at = None

            attempt.status = "failed"
            attempt.error_code = error_code
            attempt.error_detail = error_detail
            attempt.completed_at = completed

            db.commit()
            return True


def process_jobs_until_empty(limit: int = 100, *, worker_id: str = "worker-main") -> int:
    processed = 0
    for _ in range(limit):
        if not process_jobs_once(worker_id=worker_id):
            break
        processed += 1
    return processed
