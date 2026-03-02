from __future__ import annotations

import re
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import require_roles
from app.core.security import UserContext
from app.schemas import (
    DashboardActionRequest,
    DashboardState,
    PythonHistoryItem,
    PythonHistoryResponse,
    PythonRunRequest,
    PythonRunResponse,
    SQLHistoryItem,
    SQLHistoryResponse,
    SQLRunRequest,
    SQLRunResponse,
)
from app.services.audit import audit
from app.services.repositories import session_repository
from app.services.store import store

router = APIRouter(prefix="/v1/sessions", tags=["simulator-runtime"])

DISALLOWED_SQL_PATTERN = re.compile(r"\b(drop|delete|truncate|update|insert|alter|create)\b", re.IGNORECASE)
DISALLOWED_PYTHON_PATTERN = re.compile(
    r"\b(import\s+os|import\s+subprocess|open\s*\(|exec\s*\(|eval\s*\(|__import__\s*\()", re.IGNORECASE
)


def _get_session_for_access(session_id: UUID, user: UserContext, allow_reviewer: bool = True) -> dict:
    session_obj = session_repository.get_session(session_id)
    if session_obj is None or session_obj.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Session not found")
    session = session_obj.model_dump(mode="json")

    if user.role == "candidate" and session.get("candidate_id") != user.user_id:
        raise HTTPException(status_code=404, detail="Session not found")

    if user.role in {"reviewer", "org_admin"} and not allow_reviewer:
        raise HTTPException(status_code=403, detail="Forbidden")

    return session


def _sql_history(session_id: UUID) -> list[dict]:
    return store.session_sql_history.setdefault(session_id, [])


def _python_history(session_id: UUID) -> list[dict]:
    return store.session_python_history.setdefault(session_id, [])


def _dashboard_state(session_id: UUID) -> dict:
    return store.dashboard_state.setdefault(
        session_id,
        DashboardState().model_dump(mode="json"),
    )


@router.post("/{session_id}/sql/run", response_model=SQLRunResponse)
def run_sql_query(
    session_id: UUID,
    payload: SQLRunRequest,
    user: UserContext = Depends(require_roles("candidate")),
) -> SQLRunResponse:
    _get_session_for_access(session_id, user, allow_reviewer=False)
    query = payload.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="query cannot be empty")

    if DISALLOWED_SQL_PATTERN.search(query):
        error_item = SQLHistoryItem(query=query, ok=False, error="disallowed_sql_operation")
        _sql_history(session_id).append(error_item.model_dump(mode="json"))
        session_repository.append_events(
            session_id,
            [{"event_type": "sql_query_error", "payload": {"reason": "disallowed_sql_operation"}}],
        )
        raise HTTPException(status_code=400, detail="disallowed sql operation")

    columns = ["metric", "value"]
    rows = [
        {"metric": "conversion_rate", "value": 0.42},
        {"metric": "activation_rate", "value": 0.57},
    ]
    response = SQLRunResponse(ok=True, row_count=len(rows), columns=columns, rows=rows, runtime_ms=42)

    history_item = SQLHistoryItem(query=query, ok=True, row_count=response.row_count, columns=columns)
    _sql_history(session_id).append(history_item.model_dump(mode="json"))
    session_repository.append_events(
        session_id,
        [{"event_type": "sql_query_run", "payload": {"row_count": response.row_count, "runtime_ms": response.runtime_ms}}],
    )
    audit(user, "run_sql", "session", str(session_id), {"row_count": response.row_count})
    return response


@router.get("/{session_id}/sql/history", response_model=SQLHistoryResponse)
def list_sql_history(
    session_id: UUID,
    user: UserContext = Depends(require_roles("candidate", "reviewer", "org_admin")),
) -> SQLHistoryResponse:
    _get_session_for_access(session_id, user, allow_reviewer=True)
    items = [SQLHistoryItem.model_validate(item) for item in _sql_history(session_id)]
    return SQLHistoryResponse(items=items)


@router.post("/{session_id}/python/run", response_model=PythonRunResponse)
def run_python_code(
    session_id: UUID,
    payload: PythonRunRequest,
    user: UserContext = Depends(require_roles("candidate")),
) -> PythonRunResponse:
    _get_session_for_access(session_id, user, allow_reviewer=False)
    code = payload.code.strip()
    if not code:
        raise HTTPException(status_code=400, detail="code cannot be empty")

    if DISALLOWED_PYTHON_PATTERN.search(code):
        error_item = PythonHistoryItem(code=code, ok=False, error="disallowed_python_operation")
        _python_history(session_id).append(error_item.model_dump(mode="json"))
        session_repository.append_events(
            session_id,
            [{"event_type": "python_code_error", "payload": {"reason": "disallowed_python_operation"}}],
        )
        raise HTTPException(status_code=400, detail="disallowed python operation")

    stdout = "   a\n0  1\n1  2\n2  3" if any(kw in code for kw in ["pandas", "DataFrame", "pd."]) else "hello"
    plot_url = "/mock/plot.png" if any(kw in code for kw in ["matplotlib", "plt.", "plt.show"]) else None

    response = PythonRunResponse(ok=True, stdout=stdout, stderr=None, plot_url=plot_url, runtime_ms=38)

    history_item = PythonHistoryItem(code=code, ok=True, stdout=stdout, plot_url=plot_url, runtime_ms=response.runtime_ms)
    _python_history(session_id).append(history_item.model_dump(mode="json"))
    session_repository.append_events(
        session_id,
        [{"event_type": "python_code_run", "payload": {"runtime_ms": response.runtime_ms, "has_plot": plot_url is not None}}],
    )
    audit(user, "run_python", "session", str(session_id), {"runtime_ms": response.runtime_ms})
    return response


@router.get("/{session_id}/python/history", response_model=PythonHistoryResponse)
def list_python_history(
    session_id: UUID,
    user: UserContext = Depends(require_roles("candidate", "reviewer", "org_admin")),
) -> PythonHistoryResponse:
    _get_session_for_access(session_id, user, allow_reviewer=True)
    items = [PythonHistoryItem.model_validate(item) for item in _python_history(session_id)]
    return PythonHistoryResponse(items=items)


@router.get("/{session_id}/dashboard/state", response_model=DashboardState)
def get_dashboard_state(
    session_id: UUID,
    user: UserContext = Depends(require_roles("candidate", "reviewer", "org_admin")),
) -> DashboardState:
    _get_session_for_access(session_id, user, allow_reviewer=True)
    return DashboardState.model_validate(_dashboard_state(session_id))


@router.post("/{session_id}/dashboard/action", response_model=DashboardState)
def apply_dashboard_action(
    session_id: UUID,
    payload: DashboardActionRequest,
    user: UserContext = Depends(require_roles("candidate")),
) -> DashboardState:
    _get_session_for_access(session_id, user, allow_reviewer=False)
    state = _dashboard_state(session_id)
    action_type = payload.action_type.strip().lower()

    if action_type == "apply_filter":
        if not isinstance(payload.payload, dict):
            raise HTTPException(status_code=400, detail="payload must be an object")
        state["filters"] = {**state.get("filters", {}), **payload.payload}
        event_type = "dashboard_filter_applied"
    elif action_type == "set_view":
        view = payload.payload.get("view")
        if not isinstance(view, str) or not view:
            raise HTTPException(status_code=400, detail="payload.view is required for set_view")
        state["view"] = view
        event_type = "dashboard_view_changed"
    elif action_type == "annotate":
        note = payload.payload.get("note")
        if not isinstance(note, str) or not note:
            raise HTTPException(status_code=400, detail="payload.note is required for annotate")
        state.setdefault("annotations", []).append(note)
        event_type = "dashboard_annotation_added"
    else:
        raise HTTPException(status_code=400, detail="unsupported action_type")

    state["updated_at"] = datetime.now(timezone.utc).isoformat()
    store.dashboard_state[session_id] = state
    session_repository.append_events(session_id, [{"event_type": event_type, "payload": payload.payload}])
    audit(user, "dashboard_action", "session", str(session_id), {"action_type": action_type})
    return DashboardState.model_validate(state)
