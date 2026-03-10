import os
from uuid import uuid4

os.environ["MOONSHOT_DATABASE_URL"] = (
    f"sqlite+pysqlite:////tmp/moonshot_test_{uuid4().hex}.db"
)
os.environ.setdefault("MOONSHOT_AUTH_BOOTSTRAP_TOKEN", "moonshot-bootstrap-dev")
os.environ.setdefault("MOONSHOT_MODEL_PROVIDER", "litellm")
os.environ.setdefault("MOONSHOT_LITELLM_BASE_URL", "https://litellm.local/v1")
os.environ.setdefault("MOONSHOT_LITELLM_API_KEY", "sk-test")

from fastapi.testclient import TestClient
import pytest

from app.api.v1.endpoints.simulator_runtime import _matcher_cache, _schema_cache
from app.core.security import issue_access_token
from app.main import app
from app.providers.model_catalog import CatalogSnapshot, DEFAULT_MODEL_BY_AGENT, REQUIRED_MODEL_IDS, clear_model_catalog_cache
from app.services.store import store


@pytest.fixture()
def client() -> TestClient:
    store.ensure_schema()
    store.business_context_packs.clear()
    store.cases.clear()
    store.task_families.clear()
    store.rubrics.clear()
    store.sessions.clear()
    store.session_events.clear()
    store.scores.clear()
    store.reports.clear()
    store.human_reviews.clear()
    store.exports.clear()
    store.redteam_runs.clear()
    store.review_queue.clear()
    store.audit_logs.clear()
    store.idempotency_cache.clear()
    store.admin_policies.clear()
    store.session_sql_history.clear()
    store.session_python_history.clear()
    store.dashboard_state.clear()
    store.job_attempts.clear()
    store.job_runs.clear()
    store.task_quality_signals.clear()
    store.coach_feedback.clear()
    store.interpretation_views.clear()
    store.context_injection_traces.clear()
    store.memory_entries.clear()
    store.memory_chunks.clear()
    store.session_memory_digests.clear()
    store.fairness_smoke_runs.clear()
    store.worker_heartbeats.clear()
    store.case_datasets.clear()
    store.session_deliverables.clear()
    _matcher_cache.clear()
    _schema_cache.clear()
    return TestClient(app)


@pytest.fixture(autouse=True)
def litellm_mocks(monkeypatch):
    clear_model_catalog_cache()
    snapshot = CatalogSnapshot(
        required_models=REQUIRED_MODEL_IDS,
        available_models=frozenset(REQUIRED_MODEL_IDS),
        resolved_models_by_required={model_id: model_id for model_id in REQUIRED_MODEL_IDS},
        missing_required_models=(),
        defaults_by_agent=DEFAULT_MODEL_BY_AGENT,
    )

    monkeypatch.setattr("app.providers.model_catalog.get_model_catalog_snapshot", lambda: snapshot)
    monkeypatch.setattr("app.providers.litellm_provider.get_model_catalog_snapshot", lambda: snapshot)

    def _fake_completion(**kwargs):
        messages = kwargs.get("messages") or []
        content = ""
        if isinstance(messages, list) and messages:
            first = messages[0]
            if isinstance(first, dict):
                content = str(first.get("content", ""))
        return {"choices": [{"message": {"content": content}}]}

    monkeypatch.setattr("app.providers.litellm_provider._default_completion_fn", _fake_completion)


@pytest.fixture()
def admin_headers() -> dict[str, str]:
    token = issue_access_token(
        role="org_admin", user_id="admin_1", tenant_id="tenant_a"
    ).access_token
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def reviewer_headers() -> dict[str, str]:
    token = issue_access_token(
        role="reviewer", user_id="reviewer_1", tenant_id="tenant_a"
    ).access_token
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def candidate_headers() -> dict[str, str]:
    token = issue_access_token(
        role="candidate", user_id="candidate_1", tenant_id="tenant_a"
    ).access_token
    return {"Authorization": f"Bearer {token}"}
