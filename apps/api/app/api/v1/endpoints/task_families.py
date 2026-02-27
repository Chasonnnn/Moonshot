from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import JobAccepted, TaskFamily, TaskFamilyPublishRequest, TaskFamilyReviewRequest, TaskQualitySignal
from app.services.audit import audit
from app.services.jobs import submit_job
from app.services.repositories import case_repository
from app.services.task_quality import get_task_quality

router = APIRouter(prefix="/v1/task-families", tags=["task-families"])


def _case_for_task_family(task_family: TaskFamily):
    case_payload = case_repository.get_case(task_family.case_id)
    if case_payload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found for task family")
    return case_payload


def _get_task_family_for_tenant(task_family_id: UUID, tenant_id: str) -> TaskFamily:
    existing = case_repository.get_task_family(task_family_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task family not found")
    case_payload = _case_for_task_family(existing)
    if case_payload.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task family not found")
    return existing


@router.get("", response_model=dict[str, list[TaskFamily]])
def list_task_families(
    user: UserContext = Depends(require_roles("org_admin", "reviewer")),
) -> dict[str, list[TaskFamily]]:
    items = case_repository.list_task_families(user.tenant_id)
    return {"items": items}


@router.get("/{task_family_id}", response_model=TaskFamily)
def get_task_family(
    task_family_id: UUID,
    user: UserContext = Depends(require_roles("org_admin", "reviewer")),
) -> TaskFamily:
    return _get_task_family_for_tenant(task_family_id, user.tenant_id)


@router.post("/{task_family_id}/review", response_model=TaskFamily)
def review_task_family(
    task_family_id: UUID,
    payload: TaskFamilyReviewRequest,
    user: UserContext = Depends(require_roles("reviewer", "org_admin")),
) -> TaskFamily:
    existing = _get_task_family_for_tenant(task_family_id, user.tenant_id).model_dump(mode="json")
    current_status = existing.get("status", "generated")

    if current_status == "published":
        raise HTTPException(status_code=400, detail="Published task family cannot be re-reviewed")

    decision = payload.decision.strip().lower()
    if decision == "approve":
        next_status = "approved"
    elif decision == "request_changes":
        next_status = "review_changes_requested"
    else:
        raise HTTPException(status_code=400, detail="Invalid review decision")

    merged = {**existing, "status": next_status}
    task_family = TaskFamily.model_validate(merged)
    case_repository.save_task_family(task_family)
    audit(
        user,
        "review",
        "task_family",
        str(task_family_id),
        {"decision": decision, "review_note": payload.review_note},
    )
    return task_family


@router.post("/{task_family_id}/publish", response_model=TaskFamily)
def publish_task_family(
    task_family_id: UUID,
    payload: TaskFamilyPublishRequest,
    user: UserContext = Depends(require_roles("org_admin", "reviewer")),
) -> TaskFamily:
    existing = _get_task_family_for_tenant(task_family_id, user.tenant_id).model_dump(mode="json")
    if existing.get("status") != "approved":
        raise HTTPException(status_code=400, detail="Task family must be approved before publish")
    merged = {**existing, "status": "published"}
    task_family = TaskFamily.model_validate(merged)
    case_repository.save_task_family(task_family)
    audit(user, "publish", "task_family", str(task_family_id), {"approver_note": payload.approver_note})
    return task_family


@router.post("/{task_family_id}/quality/evaluate", response_model=JobAccepted, status_code=status.HTTP_202_ACCEPTED)
def evaluate_task_family_quality(
    task_family_id: UUID,
    user: UserContext = Depends(require_roles("org_admin", "reviewer")),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> JobAccepted:
    if idempotency_key is None or not idempotency_key.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing Idempotency-Key header")

    _get_task_family_for_tenant(task_family_id, user.tenant_id)
    accepted = submit_job(
        job_type="quality_evaluate",
        target_type="task_family",
        target_id=task_family_id,
        user=user,
        request_payload={"task_family_id": str(task_family_id), "evaluated_by_role": user.role},
        idempotency_key=idempotency_key,
    )
    audit(user, "submit_job", "task_family_quality", str(task_family_id), {"job_id": str(accepted.job_id)})
    return accepted


@router.get("/{task_family_id}/quality", response_model=TaskQualitySignal)
def get_task_family_quality(
    task_family_id: UUID,
    user: UserContext = Depends(require_roles("org_admin", "reviewer")),
) -> TaskQualitySignal:
    _get_task_family_for_tenant(task_family_id, user.tenant_id)
    signal = get_task_quality(task_family_id)
    if signal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task quality signal not found")
    return signal
