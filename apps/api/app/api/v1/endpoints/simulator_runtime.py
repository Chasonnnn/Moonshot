from __future__ import annotations

import csv
import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
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
from app.services.python_sandbox import (
    PythonSandboxValidationError,
    run_python_sandbox,
)
from app.services.repositories import session_repository
from app.services.sql_query_matcher import SQLQueryMatcher
from app.services.store import store

logger = logging.getLogger(__name__)

_DEMO_RUNTIME_ROOT = Path(__file__).resolve().parents[4] / "fixtures" / "demo_runtime"

# Cache of SQLQueryMatcher instances keyed by template_id
_matcher_cache: dict[str, SQLQueryMatcher] = {}

router = APIRouter(prefix="/v1/sessions", tags=["simulator-runtime"])

DISALLOWED_SQL_PATTERN = re.compile(r"\b(drop|delete|truncate|update|insert|alter|create)\b", re.IGNORECASE)
DISALLOWED_PYTHON_PATTERN = re.compile(
    r"\b(import\s+os|import\s+subprocess|import\s+socket|open\s*\(|exec\s*\(|eval\s*\(|__import__\s*\()",
    re.IGNORECASE,
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


def _get_template_id_for_session(session: dict) -> str | None:
    """Resolve the fixture template_id for a session via its task family."""
    task_family_id = session.get("task_family_id")
    if not task_family_id:
        return None
    tf_data = store.task_families.get(UUID(task_family_id) if isinstance(task_family_id, str) else task_family_id)
    if tf_data is None:
        return None
    diagnostics = tf_data.get("generation_diagnostics", {})
    return diagnostics.get("template_id")


def _get_query_matcher(template_id: str) -> SQLQueryMatcher | None:
    """Get or create a SQLQueryMatcher for the given template, if precomputed queries exist."""
    if template_id in _matcher_cache:
        return _matcher_cache[template_id]

    precomputed_path = _DEMO_RUNTIME_ROOT / template_id / "datasets" / "precomputed_queries.json"
    if not precomputed_path.exists():
        # Cache a None-equivalent empty matcher to avoid repeated filesystem checks
        _matcher_cache[template_id] = SQLQueryMatcher()
        return _matcher_cache[template_id]

    matcher = SQLQueryMatcher(precomputed_path=str(precomputed_path))
    _matcher_cache[template_id] = matcher
    return matcher


@router.post("/{session_id}/sql/run", response_model=SQLRunResponse)
def run_sql_query(
    session_id: UUID,
    payload: SQLRunRequest,
    user: UserContext = Depends(require_roles("candidate")),
) -> SQLRunResponse:
    session = _get_session_for_access(session_id, user, allow_reviewer=False)
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

    # Try precomputed query matcher if template has one
    matched_response: dict | None = None
    template_id = _get_template_id_for_session(session)
    if template_id:
        matcher = _get_query_matcher(template_id)
        if matcher and matcher.has_entries:
            matched_response = matcher.format_response(query)

    if matched_response is not None:
        response = SQLRunResponse(
            ok=matched_response["ok"],
            row_count=matched_response["row_count"],
            columns=matched_response["columns"],
            rows=matched_response["rows"],
            runtime_ms=matched_response["runtime_ms"],
        )
    else:
        # Explicitly return an empty result when no fixture matcher is available.
        response = SQLRunResponse(
            ok=True,
            row_count=0,
            columns=["message"],
            rows=[],
            runtime_ms=1,
        )

    history_item = SQLHistoryItem(query=query, ok=True, row_count=response.row_count, columns=response.columns)
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

    try:
        sandbox_result = run_python_sandbox(
            code=code,
            template_id=payload.template_id,
            round_id=payload.round_id,
            dataset_id=payload.dataset_id,
        )
    except PythonSandboxValidationError as exc:
        reason = str(exc)
        error_item = PythonHistoryItem(
            code=code,
            ok=False,
            error=reason,
            stderr=reason,
            runtime_ms=0,
        )
        _python_history(session_id).append(error_item.model_dump(mode="json"))
        session_repository.append_events(
            session_id,
            [{"event_type": "python_code_error", "payload": {"reason": reason}}],
        )
        raise HTTPException(status_code=400, detail=reason)

    response = PythonRunResponse(
        ok=sandbox_result["ok"],
        stdout=sandbox_result.get("stdout"),
        stderr=sandbox_result.get("stderr"),
        plot_url=sandbox_result.get("plot_url"),
        artifacts=sandbox_result.get("artifacts", []),
        runtime_ms=int(sandbox_result.get("runtime_ms", 0)),
    )

    history_item = PythonHistoryItem(
        code=code,
        ok=response.ok,
        stdout=response.stdout,
        stderr=response.stderr,
        plot_url=response.plot_url,
        artifacts=response.artifacts,
        error=sandbox_result.get("error"),
        runtime_ms=response.runtime_ms,
    )
    _python_history(session_id).append(history_item.model_dump(mode="json"))
    session_repository.append_events(
        session_id,
        [
            {
                "event_type": "python_code_run",
                "payload": {
                    "runtime_ms": response.runtime_ms,
                    "has_plot": response.plot_url is not None,
                    "artifact_count": len(response.artifacts),
                },
            }
        ],
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


_schema_cache: dict[str, list[dict]] = {}


def _load_dataset_schema(template_id: str) -> list[dict]:
    """Load dataset schemas from the template's datasets directory."""
    if template_id in _schema_cache:
        return _schema_cache[template_id]

    datasets_dir = _DEMO_RUNTIME_ROOT / template_id / "datasets"
    schema_files = list(datasets_dir.glob("*_schema.json")) if datasets_dir.exists() else []
    if not schema_files:
        _schema_cache[template_id] = []
        return []

    schemas = []
    for schema_path in schema_files:
        with open(schema_path) as f:
            schemas.append(json.load(f))
    _schema_cache[template_id] = schemas
    return schemas


@router.get("/{session_id}/datasets")
def list_datasets(
    session_id: UUID,
    user: UserContext = Depends(require_roles("candidate", "reviewer", "org_admin")),
):
    session = _get_session_for_access(session_id, user, allow_reviewer=True)
    template_id = _get_template_id_for_session(session)
    if not template_id:
        return {"datasets": []}
    datasets = _load_dataset_schema(template_id)
    return {"datasets": datasets}


@router.get("/{session_id}/datasets/{dataset_name}/preview")
def get_dataset_preview(
    session_id: UUID,
    dataset_name: str,
    user: UserContext = Depends(require_roles("candidate", "reviewer", "org_admin")),
):
    session = _get_session_for_access(session_id, user, allow_reviewer=True)
    template_id = _get_template_id_for_session(session)
    if not template_id:
        raise HTTPException(status_code=404, detail="Dataset not found")

    csv_path = _DEMO_RUNTIME_ROOT / template_id / "datasets" / f"{dataset_name}.csv"
    if not csv_path.exists():
        raise HTTPException(status_code=404, detail="Dataset not found")

    with open(csv_path, newline="") as f:
        reader = csv.DictReader(f)
        columns = reader.fieldnames or []
        rows = []
        for i, row in enumerate(reader):
            if i >= 20:
                break
            rows.append(row)

    return {"columns": list(columns), "rows": rows}
