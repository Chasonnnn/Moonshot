import os
from uuid import uuid4

os.environ["MOONSHOT_DATABASE_URL"] = f"sqlite+pysqlite:////tmp/moonshot_test_{uuid4().hex}.db"
os.environ.setdefault("MOONSHOT_AUTH_BOOTSTRAP_TOKEN", "moonshot-bootstrap-dev")
os.environ.setdefault("MOONSHOT_MODEL_PROVIDER", "openai")

from fastapi.testclient import TestClient
import pytest

from app.core.security import issue_access_token
from app.main import app
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
    store.exports.clear()
    store.redteam_runs.clear()
    store.review_queue.clear()
    store.audit_logs.clear()
    store.idempotency_cache.clear()
    store.admin_policies.clear()
    store.session_sql_history.clear()
    store.dashboard_state.clear()
    store.job_attempts.clear()
    store.job_runs.clear()
    store.task_quality_signals.clear()
    store.coach_feedback.clear()
    store.interpretation_views.clear()
    store.context_injection_traces.clear()
    store.fairness_smoke_runs.clear()
    return TestClient(app)


@pytest.fixture()
def admin_headers() -> dict[str, str]:
    token = issue_access_token(role="org_admin", user_id="admin_1", tenant_id="tenant_a").access_token
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def reviewer_headers() -> dict[str, str]:
    token = issue_access_token(role="reviewer", user_id="reviewer_1", tenant_id="tenant_a").access_token
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def candidate_headers() -> dict[str, str]:
    token = issue_access_token(role="candidate", user_id="candidate_1", tenant_id="tenant_a").access_token
    return {"Authorization": f"Bearer {token}"}
