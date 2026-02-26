from pathlib import Path

EXPECTED_PATHS = {
    "/health",
    "/v1/meta/version",
    "/v1/business-context/packs",
    "/v1/business-context/packs/{pack_id}",
    "/v1/cases",
    "/v1/cases/{case_id}",
    "/v1/cases/{case_id}/generate",
    "/v1/task-families",
    "/v1/task-families/{task_family_id}",
    "/v1/task-families/{task_family_id}/publish",
    "/v1/sessions",
    "/v1/sessions/{session_id}",
    "/v1/sessions/{session_id}/events",
    "/v1/sessions/{session_id}/coach/message",
    "/v1/sessions/{session_id}/submit",
    "/v1/sessions/{session_id}/score",
    "/v1/reports/{session_id}",
    "/v1/exports/{run_id}",
    "/v1/redteam/runs",
    "/v1/audit-logs",
}


def test_openapi_contains_required_paths(client):
    schema = client.get("/openapi.json").json()
    assert EXPECTED_PATHS.issubset(set(schema["paths"].keys()))


def test_docs_openapi_file_tracks_required_paths():
    spec_path = Path("/Users/chason/Moonshot/docs/03_api/openapi.yaml")
    text = spec_path.read_text(encoding="utf-8")
    for path in EXPECTED_PATHS:
        assert path in text
