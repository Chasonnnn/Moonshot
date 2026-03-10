from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import and_, or_, select, update

from app.core.config import get_settings
from app.core.request_context import get_request_id
from app.core.security import UserContext
from app.db.session import SessionLocal
from app.models.entities import JobAttemptModel, JobRunModel
from app.schemas import (
    AuditLog,
    FairnessSmokeRunCreate,
    InterpretationRequest,
    JobAccepted,
    JobResultResponse,
    JobStatus,
    MemoryAssemblerRequest,
    Report,
    ReviewQueueItem,
    Session,
)
from app.services.context_injection import append_context_trace
from app.services.demo_fixtures import generate_from_fixture, score_from_fixture
from app.services.exporting import build_export
from app.services.generation import generate_from_case
from app.services.idempotency import get_cached, set_cached
from app.services.interpretation_views import create_interpretation_view
from app.providers.registry import get_evaluator_provider
from app.services.redteam import run_redteam
from app.services.repositories import (
    case_repository,
    governance_repository,
    scoring_repository,
    session_repository,
)
from app.services.fairness import create_fairness_smoke_run
from app.services.memory import (
    memory_assembler,
    memory_projection_service,
    session_digest_service,
    sync_task_family_memory,
)
from app.services.scoring import score_session
from app.services.store import store
from app.services.task_quality import evaluate_task_quality

logger = logging.getLogger("moonshot.jobs")

ERROR_CODE_TIMEOUT = "timeout"
ERROR_CODE_POLICY_BLOCKED = "policy_blocked"
ERROR_CODE_PROVIDER_ERROR = "provider_error"
ERROR_CODE_VALIDATION = "validation_error"
ERROR_CODE_DEPENDENCY = "dependency_unavailable"
ERROR_CODE_INTERNAL = "internal_error"

JOB_PIPELINES: dict[str, list[str]] = {
    "generate": ["load_case", "generate_content", "persist_outputs"],
    "score": ["load_session", "evaluate_session", "persist_report"],
    "export": ["load_report", "transform_export_bundle", "persist_export"],
    "redteam": ["load_target", "run_redteam_checks", "persist_redteam_run"],
    "quality_evaluate": ["load_task_family", "compute_quality_signal", "persist_quality_signal"],
    "interpretation_generate": ["load_report", "build_interpretation_view", "persist_interpretation_view"],
    "fairness_smoke_run": ["load_scope", "run_fairness_checks", "persist_fairness_run"],
    "memory_reindex": ["load_memory_scope", "reindex_memory", "persist_memory_index"],
    "session_digest_refresh": ["load_session", "refresh_session_digest", "persist_session_digest"],
}

RUNNING_PROGRESS_BY_JOB_TYPE: dict[str, int] = {
    "generate": 35,
    "score": 45,
    "export": 55,
    "redteam": 40,
    "quality_evaluate": 40,
    "interpretation_generate": 50,
    "fairness_smoke_run": 45,
    "memory_reindex": 35,
    "session_digest_refresh": 35,
}

RETRYING_PROGRESS_BY_JOB_TYPE: dict[str, int] = {
    "generate": 20,
    "score": 25,
    "export": 30,
    "redteam": 25,
    "quality_evaluate": 25,
    "interpretation_generate": 30,
    "fairness_smoke_run": 25,
    "memory_reindex": 20,
    "session_digest_refresh": 20,
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _log_job_event(
    *,
    event: str,
    job_id: str,
    tenant_id: str,
    job_type: str,
    status: str,
    attempt_count: int | None = None,
    max_attempts: int | None = None,
    error_code: str | None = None,
    latency_ms: int | None = None,
) -> None:
    payload = {
        "event": event,
        "request_id": get_request_id(),
        "job_id": job_id,
        "tenant_id": tenant_id,
        "job_type": job_type,
        "status": status,
        "attempt_count": attempt_count,
        "max_attempts": max_attempts,
        "error_code": error_code,
        "latency_ms": latency_ms,
    }
    logger.info(json.dumps(payload))


def _pipeline_for(job_type: str | None) -> list[str]:
    if not job_type:
        return ["queued", "execute", "finalize"]
    return JOB_PIPELINES.get(job_type, ["queued", "execute", "finalize"])


def _current_step(status: str, job_type: str | None) -> str:
    steps = _pipeline_for(job_type)
    if status == "pending":
        return steps[0]
    if status == "running":
        return steps[1] if len(steps) > 1 else steps[0]
    if status == "retrying":
        return "retry_wait"
    if status == "failed_permanent":
        return steps[1] if len(steps) > 1 else steps[0]
    return steps[-1]


def _status_progress(status: str, job_type: str | None = None) -> int:
    if status == "completed":
        return 100
    if status == "running":
        return RUNNING_PROGRESS_BY_JOB_TYPE.get(job_type or "", 50)
    if status == "failed_permanent":
        return 100
    if status == "retrying":
        return RETRYING_PROGRESS_BY_JOB_TYPE.get(job_type or "", 25)
    return 0


def _job_status_from_row(row: JobRunModel) -> JobStatus:
    return JobStatus(
        job_id=UUID(row.id),
        status=row.status,
        job_type=row.job_type,
        target_type=row.target_type,
        target_id=row.target_id,
        progress=_status_progress(row.status, row.job_type),
        current_step=_current_step(row.status, row.job_type),
        error_code=row.error_code,
        error_detail=row.error_detail,
        submitted_at=row.created_at,
        started_at=row.started_at,
        completed_at=row.completed_at,
        next_attempt_at=row.next_attempt_at,
        lease_owner=row.lease_owner,
        lease_expires_at=row.lease_expires_at,
        attempt_count=row.attempt_count,
        max_attempts=row.max_attempts,
        last_error_code=row.error_code,
    )


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
        return ERROR_CODE_TIMEOUT
    if isinstance(exc, PermissionError):
        return ERROR_CODE_POLICY_BLOCKED
    if isinstance(exc, ValueError):
        return ERROR_CODE_VALIDATION

    message = str(exc).lower()
    if "not_found" in message or "not_submitted" in message or "unsupported_job_type" in message:
        return ERROR_CODE_VALIDATION
    if "gemini_" in message or "openai_" in message or "provider_" in message:
        return ERROR_CODE_PROVIDER_ERROR
    if "service unavailable" in message or "connection" in message or "dependency" in message:
        return ERROR_CODE_DEPENDENCY
    return ERROR_CODE_INTERNAL


def _failed_step_for(job_type: str | None, error_code: str) -> str:
    if error_code == ERROR_CODE_VALIDATION:
        return _pipeline_for(job_type)[0]
    steps = _pipeline_for(job_type)
    return steps[1] if len(steps) > 1 else steps[0]


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

    request_id = get_request_id()
    normalized_payload = dict(request_payload)
    if request_id:
        normalized_payload.setdefault("request_id", request_id)

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
                request_payload=normalized_payload,
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
    _log_job_event(
        event="job_submitted",
        job_id=str(job_id),
        tenant_id=user.tenant_id,
        job_type=job_type,
        status="pending",
        attempt_count=0,
        max_attempts=max_attempts,
    )
    return accepted


def get_job_status(job_id: UUID, tenant_id: str) -> JobStatus | None:
    with SessionLocal() as db:
        row = db.get(JobRunModel, str(job_id))
        if row is None or row.tenant_id != tenant_id:
            return None
        return _job_status_from_row(row)


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

    return [_job_status_from_row(row) for row in rows]


def get_stale_leases_for_tenant(tenant_id: str, *, limit: int = 100) -> list[JobStatus]:
    now = _now()
    with SessionLocal() as db:
        rows = (
            db.execute(
                select(JobRunModel)
                .where(JobRunModel.tenant_id == tenant_id)
                .where(JobRunModel.status == "running")
                .where(JobRunModel.lease_expires_at.is_not(None))
                .where(JobRunModel.lease_expires_at < now)
                .order_by(JobRunModel.lease_expires_at.asc())
                .limit(limit)
            )
            .scalars()
            .all()
        )
    return [_job_status_from_row(row) for row in rows]


def get_queue_runtime_metrics(tenant_id: str) -> dict[str, int]:
    now = _now()
    with SessionLocal() as db:
        rows = db.execute(select(JobRunModel).where(JobRunModel.tenant_id == tenant_id)).scalars().all()

    pending_like = [row for row in rows if row.status in {"pending", "retrying"}]
    oldest_pending_age_seconds = 0
    if pending_like:
        oldest_created = min(row.created_at for row in pending_like)
        oldest_pending_age_seconds = max(0, int((now - oldest_created).total_seconds()))

    return {
        "queue_backlog_count": len(pending_like),
        "queue_oldest_pending_age_seconds": oldest_pending_age_seconds,
        "queue_retrying_count": len([row for row in rows if row.status == "retrying"]),
        "queue_failed_permanent_count": len([row for row in rows if row.status == "failed_permanent"]),
        "queue_inflight_leased_count": len([row for row in rows if row.status == "running" and row.lease_owner is not None]),
    }


def get_job_result(job_id: UUID, tenant_id: str) -> JobResultResponse | None:
    with SessionLocal() as db:
        row = db.get(JobRunModel, str(job_id))
        if row is None or row.tenant_id != tenant_id:
            return None
        if row.result_payload is None:
            result_payload: dict[str, Any]
            if row.status in {"pending", "running", "retrying"}:
                result_payload = {
                    "error_code": "job_not_ready",
                    "error_detail": "Job result not available yet",
                    "last_error_code": row.error_code,
                    "last_error_detail": row.error_detail,
                    "current_step": _current_step(row.status, row.job_type),
                }
            elif row.error_code or row.error_detail:
                result_payload = {
                    "error_code": row.error_code,
                    "error_detail": row.error_detail,
                    "failed_step": _failed_step_for(row.job_type, row.error_code or ERROR_CODE_INTERNAL),
                }
            else:
                result_payload = {}
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

    mode = str(job.request_payload.get("mode", "live")).strip().lower()
    template_id = job.request_payload.get("template_id")
    variant_count = job.request_payload.get("variant_count")
    model_override = job.request_payload.get("model_override")
    reasoning_effort = job.request_payload.get("reasoning_effort")
    thinking_budget_tokens = job.request_payload.get("thinking_budget_tokens")
    if mode == "fixture":
        normalized_variant_count = (
            int(variant_count) if isinstance(variant_count, int) else None
        )
        generated = generate_from_fixture(
            case,
            template_id=str(template_id) if template_id is not None else None,
            variant_count=normalized_variant_count,
        )
    else:
        normalized_variant_count = (
            int(variant_count) if isinstance(variant_count, int) else None
        )
        assembled = memory_assembler.assemble(
            MemoryAssemblerRequest(
                tenant_id=job.tenant_id,
                actor_role="reviewer",
                consumer="codesign",
                query_text=f"{case.title}\n{case.scenario}",
            )
        )
        normalized_model_override = str(model_override) if isinstance(model_override, str) and model_override.strip() else None
        normalized_reasoning_effort = (
            str(reasoning_effort) if isinstance(reasoning_effort, str) and reasoning_effort.strip() else None
        )
        normalized_thinking_budget = (
            int(thinking_budget_tokens)
            if isinstance(thinking_budget_tokens, int)
            else None
        )
        override_kwargs: dict[str, Any] = {}
        if normalized_model_override is not None:
            override_kwargs["model_override"] = normalized_model_override
        if normalized_reasoning_effort is not None:
            override_kwargs["reasoning_effort"] = normalized_reasoning_effort
        if normalized_thinking_budget is not None:
            override_kwargs["thinking_budget_tokens"] = normalized_thinking_budget
        if normalized_variant_count is not None:
            override_kwargs["variant_count"] = normalized_variant_count
        if assembled.context_text:
            override_kwargs["memory_context"] = assembled.context_text
        generated = generate_from_case(case, **override_kwargs)
        generated.task_family.generation_diagnostics.update(
            {
                "memory_entry_ids": [str(entry_id) for entry_id in assembled.memory_entry_ids],
                "memory_chunk_ids": [str(chunk_id) for chunk_id in assembled.chunk_ids],
                "memory_context_hash": assembled.assembled_context_hash,
                "memory_token_budget": assembled.token_budget,
            }
        )

    case_repository.save_task_family(generated.task_family)
    case_repository.save_rubric(generated.rubric)
    sync_task_family_memory(generated.task_family.id)

    _audit_system(
        job.tenant_id,
        "generate",
        "case",
        str(case_id),
        {
            "task_family_id": str(generated.task_family.id),
            "mode": mode,
            "template_id": template_id,
            "variant_count": variant_count,
        },
    )
    return generated.model_dump(mode="json")


def _handle_score_session(job: JobRunModel) -> dict[str, Any]:
    session_id = UUID(job.request_payload["session_id"])
    session = session_repository.get_session(session_id)
    if session is None:
        raise RuntimeError("session_not_found")
    if session.status != "submitted":
        raise RuntimeError("session_not_submitted")

    events = session_repository.list_events(session_id)
    task_family = case_repository.get_task_family(session.task_family_id)
    rubric = case_repository.get_rubric(task_family.rubric_id) if task_family is not None else None
    task_prompt = task_family.variants[0].prompt if task_family is not None and task_family.variants else None
    scoring_config = task_family.scoring_config if task_family is not None else None
    mode = str(job.request_payload.get("mode", "live")).strip().lower()
    template_id = job.request_payload.get("template_id")
    if template_id is None and isinstance(session.policy, dict):
        policy_template_id = session.policy.get("demo_template_id")
        if isinstance(policy_template_id, str) and policy_template_id.strip():
            template_id = policy_template_id.strip()

    session_digest_service.refresh(session_id, tenant_id=job.tenant_id, force=False)
    assembled = memory_assembler.assemble(
        MemoryAssemblerRequest(
            tenant_id=job.tenant_id,
            actor_role="reviewer",
            consumer="evaluator",
            query_text=f"{task_prompt or ''}\n{session.final_response or ''}",
            session_id=session_id,
        )
    )

    if mode == "fixture":
        score_result, interpretation = score_from_fixture(
            session_id=session_id,
            template_id=str(template_id) if template_id is not None else None,
            events=events,
            rubric_version=rubric.version if rubric is not None else "fixture-v1",
            task_family_version=task_family.version if task_family is not None else "fixture-v1",
        )
    else:
        model_override = job.request_payload.get("model_override")
        reasoning_effort = job.request_payload.get("reasoning_effort")
        thinking_budget_tokens = job.request_payload.get("thinking_budget_tokens")
        normalized_model_override = str(model_override) if isinstance(model_override, str) and model_override.strip() else None
        normalized_reasoning_effort = (
            str(reasoning_effort) if isinstance(reasoning_effort, str) and reasoning_effort.strip() else None
        )
        normalized_thinking_budget = (
            int(thinking_budget_tokens)
            if isinstance(thinking_budget_tokens, int)
            else None
        )
        provider_kwargs: dict[str, Any] = {}
        if normalized_model_override is not None:
            provider_kwargs["model_override"] = normalized_model_override
        if normalized_reasoning_effort is not None:
            provider_kwargs["reasoning_effort"] = normalized_reasoning_effort
        if normalized_thinking_budget is not None:
            provider_kwargs["thinking_budget_tokens"] = normalized_thinking_budget
        provider = get_evaluator_provider(**provider_kwargs)

        score_result, interpretation = score_session(
            session_id,
            events,
            rubric=rubric,
            task_prompt=task_prompt,
            memory_context=assembled.context_text,
            final_response=session.final_response,
            provider=provider,
            scoring_config=scoring_config,
        )
    scoring_repository.save_score(score_result)
    report = Report(session_id=session_id, score_result=score_result, interpretation=interpretation)
    scoring_repository.save_report(report)
    append_context_trace(
        session_id=session_id,
        tenant_id=job.tenant_id,
        agent_type="evaluator",
        actor_role="system",
        mode="assessment",
        context_keys=["task_rubric", "scoring_config", "session_events"],
        policy_version=None,
        memory_entry_ids=assembled.memory_entry_ids,
        chunk_ids=assembled.chunk_ids,
        ranking_features=assembled.ranking_features,
        query_text=assembled.query_text,
        token_budget=assembled.token_budget,
        assembled_context_hash=assembled.assembled_context_hash,
    )

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
    session_digest_service.refresh(session_id, tenant_id=job.tenant_id, force=True)

    _audit_system(
        job.tenant_id,
        "score",
        "session",
        str(session_id),
        {
            "model_hash": score_result.model_hash,
            "scorer_version": score_result.scorer_version,
            "mode": mode,
            "template_id": template_id,
        },
    )
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
    result = run_redteam(
        tenant_id=job.tenant_id,
        target_type=target_type,
        target_id=target_id,
        created_by=job.created_by,
        submitted_job_id=UUID(job.id),
        request_id=job.request_payload.get("request_id"),
    )
    store.redteam_runs[result.id] = result.model_dump(mode="json")
    _audit_system(job.tenant_id, "run", "redteam", str(result.id), {"target_type": target_type, "target_id": str(target_id)})
    return result.model_dump(mode="json")


def _handle_quality_evaluate(job: JobRunModel) -> dict[str, Any]:
    task_family_id = UUID(job.request_payload["task_family_id"])
    evaluated_by_role = str(job.request_payload.get("evaluated_by_role", "system"))
    signal = evaluate_task_quality(task_family_id, evaluated_by_role=evaluated_by_role)
    sync_task_family_memory(task_family_id)
    _audit_system(
        job.tenant_id,
        "evaluate_quality",
        "task_family",
        str(task_family_id),
        {"quality_score": signal.quality_score},
    )
    return signal.model_dump(mode="json")


def _handle_interpretation_generate(job: JobRunModel) -> dict[str, Any]:
    session_id = UUID(job.request_payload["session_id"])
    request_payload = InterpretationRequest.model_validate(job.request_payload["interpretation_request"])
    view = create_interpretation_view(session_id, request_payload, tenant_id=job.tenant_id)
    assembled = memory_assembler.assemble(
        MemoryAssemblerRequest(
            tenant_id=job.tenant_id,
            actor_role="reviewer",
            consumer="evaluator",
            query_text=" ".join(request_payload.focus_dimensions) or "interpretation analysis",
            session_id=session_id,
        )
    )
    append_context_trace(
        session_id=session_id,
        tenant_id=job.tenant_id,
        agent_type="evaluator",
        actor_role="system",
        mode="analysis",
        context_keys=["task_rubric", "score_result", "interpretation_request"],
        policy_version=None,
        memory_entry_ids=assembled.memory_entry_ids,
        chunk_ids=assembled.chunk_ids,
        ranking_features=assembled.ranking_features,
        query_text=assembled.query_text,
        token_budget=assembled.token_budget,
        assembled_context_hash=assembled.assembled_context_hash,
    )
    _audit_system(
        job.tenant_id,
        "interpret",
        "report",
        str(session_id),
        {"view_id": str(view.view_id)},
    )
    return view.model_dump(mode="json")


def _handle_fairness_smoke_run(job: JobRunModel) -> dict[str, Any]:
    payload = FairnessSmokeRunCreate.model_validate(job.request_payload)
    run = create_fairness_smoke_run(
        job.tenant_id,
        payload,
        created_by=job.created_by,
        submitted_job_id=UUID(job.id),
        request_id=job.request_payload.get("request_id"),
    )
    _audit_system(
        job.tenant_id,
        "fairness_smoke_run",
        "fairness",
        str(run.id),
        {"scope": run.scope, "sample_size": run.summary.get("sample_size", 0)},
    )
    return run.model_dump(mode="json")


def _handle_memory_reindex(job: JobRunModel) -> dict[str, Any]:
    reindexed = memory_projection_service.reindex_tenant(job.tenant_id)
    _audit_system(
        job.tenant_id,
        "memory_reindex",
        "tenant",
        job.tenant_id,
        {"reindexed_entries": reindexed},
    )
    return {"tenant_id": job.tenant_id, "reindexed_entries": reindexed}


def _handle_session_digest_refresh(job: JobRunModel) -> dict[str, Any]:
    session_id = UUID(job.request_payload["session_id"])
    digest = session_digest_service.refresh(session_id, tenant_id=job.tenant_id, force=True)
    _audit_system(
        job.tenant_id,
        "session_digest_refresh",
        "session",
        str(session_id),
        {"last_event_offset": digest.last_event_offset},
    )
    return digest.model_dump(mode="json")


def _execute_job(job: JobRunModel) -> dict[str, Any]:
    if job.job_type == "generate":
        return _handle_generate_case(job)
    if job.job_type == "score":
        return _handle_score_session(job)
    if job.job_type == "redteam":
        return _handle_redteam(job)
    if job.job_type == "export":
        return _handle_export_session(job)
    if job.job_type == "quality_evaluate":
        return _handle_quality_evaluate(job)
    if job.job_type == "interpretation_generate":
        return _handle_interpretation_generate(job)
    if job.job_type == "fairness_smoke_run":
        return _handle_fairness_smoke_run(job)
    if job.job_type == "memory_reindex":
        return _handle_memory_reindex(job)
    if job.job_type == "session_digest_refresh":
        return _handle_session_digest_refresh(job)
    raise RuntimeError("unsupported_job_type")


def _claim_next_job(*, worker_id: str, now: datetime) -> tuple[str, str] | None:
    lease_seconds = float(get_settings().worker_lease_seconds)
    lease_expires_at = now + timedelta(seconds=lease_seconds)

    for _ in range(8):
        with SessionLocal() as db:
            candidate = (
                db.execute(
                    select(
                        JobRunModel.id,
                        JobRunModel.tenant_id,
                        JobRunModel.job_type,
                        JobRunModel.status,
                        JobRunModel.attempt_count,
                    )
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
            _log_job_event(
                event="job_claimed",
                job_id=str(candidate.id),
                tenant_id=str(candidate.tenant_id),
                job_type=str(candidate.job_type),
                status="running",
                attempt_count=next_attempt_no,
            )
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
            latency_ms = max(1, int((completed - now).total_seconds() * 1000))
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
            _log_job_event(
                event="job_completed",
                job_id=job.id,
                tenant_id=job.tenant_id,
                job_type=job.job_type,
                status=job.status,
                attempt_count=job.attempt_count,
                max_attempts=job.max_attempts,
                latency_ms=latency_ms,
            )
            return True
        except Exception as exc:
            completed = _now()
            latency_ms = max(1, int((completed - now).total_seconds() * 1000))
            error_code = _classify_error(exc)
            error_detail = str(exc)

            if int(job.attempt_count) >= int(job.max_attempts):
                job.status = "failed_permanent"
                job.completed_at = completed
                job.next_attempt_at = None
                job.result_payload = {
                    "error_code": error_code,
                    "error_detail": error_detail,
                    "failed_step": _failed_step_for(job.job_type, error_code),
                }
            else:
                job.status = "retrying"
                settings = get_settings()
                retry_delay_seconds = float(settings.worker_retry_base_seconds) * (2 ** (int(job.attempt_count) - 1))
                job.next_attempt_at = completed + timedelta(seconds=retry_delay_seconds)
                job.result_payload = None

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
            _log_job_event(
                event="job_failed_permanent" if job.status == "failed_permanent" else "job_retry_scheduled",
                job_id=job.id,
                tenant_id=job.tenant_id,
                job_type=job.job_type,
                status=job.status,
                attempt_count=job.attempt_count,
                max_attempts=job.max_attempts,
                error_code=error_code,
                latency_ms=latency_ms,
            )
            return True


def process_jobs_until_empty(limit: int = 100, *, worker_id: str = "worker-main") -> int:
    processed = 0
    for _ in range(limit):
        if not process_jobs_once(worker_id=worker_id):
            break
        processed += 1
    return processed
