from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import TaskFamily, TaskFamilyPublishRequest
from app.services.audit import audit
from app.services.store import store

router = APIRouter(prefix="/v1/task-families", tags=["task-families"])


def _case_for_task_family(task_family: dict):
    case_id = UUID(task_family["case_id"])
    case_payload = store.cases.get(case_id)
    if case_payload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found for task family")
    return case_payload


def _get_task_family_for_tenant(task_family_id: UUID, tenant_id: str) -> TaskFamily:
    existing = store.task_families.get(task_family_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task family not found")
    case_payload = _case_for_task_family(existing)
    if case_payload["tenant_id"] != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task family not found")
    return TaskFamily.model_validate(existing)


@router.get("", response_model=dict[str, list[TaskFamily]])
def list_task_families(
    user: UserContext = Depends(require_roles("org_admin", "reviewer")),
) -> dict[str, list[TaskFamily]]:
    items: list[TaskFamily] = []
    for row in store.task_families.values():
        case_payload = store.cases.get(UUID(row["case_id"]))
        if case_payload is None:
            continue
        if case_payload["tenant_id"] != user.tenant_id:
            continue
        items.append(TaskFamily.model_validate(row))
    return {"items": items}


@router.get("/{task_family_id}", response_model=TaskFamily)
def get_task_family(
    task_family_id: UUID,
    user: UserContext = Depends(require_roles("org_admin", "reviewer")),
) -> TaskFamily:
    return _get_task_family_for_tenant(task_family_id, user.tenant_id)


@router.post("/{task_family_id}/publish", response_model=TaskFamily)
def publish_task_family(
    task_family_id: UUID,
    payload: TaskFamilyPublishRequest,
    user: UserContext = Depends(require_roles("org_admin", "reviewer")),
) -> TaskFamily:
    existing = _get_task_family_for_tenant(task_family_id, user.tenant_id).model_dump(mode="json")
    merged = {**existing, "status": "published"}
    task_family = TaskFamily.model_validate(merged)
    store.task_families[task_family_id] = task_family.model_dump(mode="json")
    audit(user, "publish", "task_family", str(task_family_id), {"approver_note": payload.approver_note})
    return task_family
