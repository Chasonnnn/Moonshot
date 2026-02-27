from fastapi.testclient import TestClient
import pytest

from app.main import app
from app.services.store import store


@pytest.fixture()
def client() -> TestClient:
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
    return TestClient(app)


@pytest.fixture()
def admin_headers() -> dict[str, str]:
    return {"X-Role": "org_admin", "X-User-Id": "admin_1", "X-Tenant-Id": "tenant_a"}


@pytest.fixture()
def reviewer_headers() -> dict[str, str]:
    return {"X-Role": "reviewer", "X-User-Id": "reviewer_1", "X-Tenant-Id": "tenant_a"}


@pytest.fixture()
def candidate_headers() -> dict[str, str]:
    return {"X-Role": "candidate", "X-User-Id": "candidate_1", "X-Tenant-Id": "tenant_a"}
