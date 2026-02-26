from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import TaskFamily, TaskFamilyPublishRequest
from app.services.audit import audit
from app.services.store import store

router = APIRouter(prefix="/v1/task-families", tags=["task-families"])


@router.post("/{task_family_id}/publish", response_model=TaskFamily)
def publish_task_family(
    task_family_id: UUID,
    payload: TaskFamilyPublishRequest,
    user: UserContext = Depends(require_roles("org_admin", "reviewer")),
) -> TaskFamily:
    existing = store.task_families.get(task_family_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task family not found")

    merged = {**existing, "status": "published"}
    task_family = TaskFamily.model_validate(merged)
    store.task_families[task_family_id] = task_family.model_dump(mode="json")
    audit(user, "publish", "task_family", str(task_family_id), {"approver_note": payload.approver_note})
    return task_family
