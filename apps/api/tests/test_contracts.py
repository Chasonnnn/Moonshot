from pathlib import Path
import yaml

EXPECTED_PATHS = {
    "/health",
    "/v1/meta/version",
    "/v1/auth/token",
    "/v1/jobs",
    "/v1/jobs/stale-leases",
    "/v1/jobs/{job_id}",
    "/v1/jobs/{job_id}/result",
    "/v1/slo/probes",
    "/v1/workers/health",
    "/v1/admin/policies",
    "/v1/admin/policies/purge-expired",
    "/v1/business-context/packs",
    "/v1/business-context/packs/{pack_id}",
    "/v1/cases",
    "/v1/cases/{case_id}",
    "/v1/cases/{case_id}/generate",
    "/v1/task-families",
    "/v1/task-families/{task_family_id}",
    "/v1/task-families/{task_family_id}/publish",
    "/v1/task-families/{task_family_id}/review",
    "/v1/task-families/{task_family_id}/quality/evaluate",
    "/v1/task-families/{task_family_id}/quality",
    "/v1/sessions",
    "/v1/sessions/{session_id}",
    "/v1/sessions/{session_id}/events",
    "/v1/sessions/{session_id}/mode",
    "/v1/sessions/{session_id}/sql/run",
    "/v1/sessions/{session_id}/sql/history",
    "/v1/sessions/{session_id}/dashboard/state",
    "/v1/sessions/{session_id}/dashboard/action",
    "/v1/sessions/{session_id}/coach/message",
    "/v1/sessions/{session_id}/coach/feedback",
    "/v1/sessions/{session_id}/submit",
    "/v1/sessions/{session_id}/score",
    "/v1/reports/{session_id}",
    "/v1/reports/{session_id}/summary",
    "/v1/reports/{session_id}/interpret",
    "/v1/reports/{session_id}/interpretations/{view_id}",
    "/v1/exports",
    "/v1/exports/{run_id}",
    "/v1/redteam/runs",
    "/v1/audit-logs",
    "/v1/audit-logs/verify",
    "/v1/context/injection-traces/{session_id}",
    "/v1/fairness/smoke-runs",
    "/v1/fairness/smoke-runs/{run_id}",
    "/v1/review-queue",
    "/v1/review-queue/{session_id}",
    "/v1/review-queue/{session_id}/resolve",
}


def test_openapi_contains_required_paths(client):
    schema = client.get("/openapi.json").json()
    assert EXPECTED_PATHS.issubset(set(schema["paths"].keys()))


def test_docs_openapi_file_tracks_required_paths():
    spec_path = Path("/Users/chason/Moonshot/docs/03_api/openapi.yaml")
    text = spec_path.read_text(encoding="utf-8")
    for path in EXPECTED_PATHS:
        assert path in text


def test_changelog_contains_openapi_version():
    spec_path = Path("/Users/chason/Moonshot/docs/03_api/openapi.yaml")
    changelog_path = Path("/Users/chason/Moonshot/docs/03_api/changelog.md")

    payload = yaml.safe_load(spec_path.read_text(encoding="utf-8"))
    version = payload["info"]["version"]
    changelog = changelog_path.read_text(encoding="utf-8")
    assert f"## {version} - " in changelog
