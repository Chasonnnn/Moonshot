from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[3]

EXPECTED_PATHS = {
    "/health",
    "/v1/meta/version",
    "/v1/meta/model-options",
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
    "/v1/sessions/{session_id}/python/run",
    "/v1/sessions/{session_id}/python/history",
    "/v1/sessions/{session_id}/dashboard/state",
    "/v1/sessions/{session_id}/dashboard/action",
    "/v1/sessions/{session_id}/coach/message",
    "/v1/sessions/{session_id}/coach/feedback",
    "/v1/sessions/{session_id}/submit",
    "/v1/sessions/{session_id}/score",
    "/v1/reports/{session_id}",
    "/v1/reports/{session_id}/summary",
    "/v1/reports/{session_id}/human-review",
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


def test_openapi_session_events_has_read_and_write_operations(client):
    schema = client.get("/openapi.json").json()
    operations = schema["paths"]["/v1/sessions/{session_id}/events"]
    assert "get" in operations
    assert "post" in operations


def test_openapi_session_mode_enum_is_four_modes(client):
    schema = client.get("/openapi.json").json()
    mode_enum = schema["components"]["schemas"]["SessionModeRequest"]["properties"]["mode"]["enum"]
    assert sorted(mode_enum) == sorted(
        ["practice", "assessment", "assessment_no_ai", "assessment_ai_assisted"]
    )


def test_openapi_generate_and_score_include_fixture_mode_payloads(client):
    schema = client.get("/openapi.json").json()
    components = schema["components"]["schemas"]

    def resolve_properties(node: dict) -> dict:
        if "$ref" in node:
            ref = str(node["$ref"]).split("/")[-1]
            return resolve_properties(components[ref])
        for keyword in ("allOf", "anyOf", "oneOf"):
            if keyword in node:
                for child in node[keyword]:
                    props = resolve_properties(child)
                    if props:
                        return props
        return node.get("properties", {})

    generate_post = schema["paths"]["/v1/cases/{case_id}/generate"]["post"]
    assert "requestBody" in generate_post
    generate_schema = generate_post["requestBody"]["content"]["application/json"]["schema"]
    generate_properties = resolve_properties(generate_schema)
    assert "mode" in generate_properties
    assert "template_id" in generate_properties
    assert "variant_count" in generate_properties
    assert "model_override" in generate_properties
    assert "reasoning_effort" in generate_properties
    assert "thinking_budget_tokens" in generate_properties

    score_post = schema["paths"]["/v1/sessions/{session_id}/score"]["post"]
    assert "requestBody" in score_post
    score_schema = score_post["requestBody"]["content"]["application/json"]["schema"]
    score_properties = resolve_properties(score_schema)
    assert "mode" in score_properties
    assert "template_id" in score_properties
    assert "model_override" in score_properties
    assert "reasoning_effort" in score_properties
    assert "thinking_budget_tokens" in score_properties

    coach_post = schema["paths"]["/v1/sessions/{session_id}/coach/message"]["post"]
    assert "requestBody" in coach_post
    coach_schema = coach_post["requestBody"]["content"]["application/json"]["schema"]
    coach_properties = resolve_properties(coach_schema)
    assert "model_override" in coach_properties
    assert "reasoning_effort" in coach_properties
    assert "thinking_budget_tokens" in coach_properties


def test_openapi_fixture_variant_and_rubric_detail_fields_exist(client):
    schema = client.get("/openapi.json").json()
    components = schema["components"]["schemas"]

    task_variant = components["TaskVariant"]["properties"]
    assert "skill" in task_variant
    assert "difficulty_level" in task_variant
    assert "round_hint" in task_variant
    assert "estimated_minutes" in task_variant
    assert "deliverables" in task_variant
    assert "artifact_refs" in task_variant


def test_openapi_python_runtime_and_report_summary_extensions_exist(client):
    schema = client.get("/openapi.json").json()
    components = schema["components"]["schemas"]

    python_run_request = components["PythonRunRequest"]["properties"]
    assert "template_id" in python_run_request
    assert "round_id" in python_run_request
    assert "dataset_id" in python_run_request

    runtime_artifact = components["RuntimeArtifact"]["properties"]
    assert "name" in runtime_artifact
    assert "mime_type" in runtime_artifact
    assert "uri" in runtime_artifact
    assert "bytes" in runtime_artifact
    assert "kind" in runtime_artifact

    python_run_response = components["PythonRunResponse"]["properties"]
    assert "artifacts" in python_run_response

    python_history_item = components["PythonHistoryItem"]["properties"]
    assert "artifacts" in python_history_item

    report_summary = components["ReportSummary"]["properties"]
    assert "has_human_review" in report_summary
    assert "final_score_source" in report_summary
    assert "final_confidence" in report_summary


def test_docs_openapi_file_tracks_required_paths():
    spec_path = ROOT / "docs" / "03_api" / "openapi.yaml"
    text = spec_path.read_text(encoding="utf-8")
    for path in EXPECTED_PATHS:
        assert path in text


def test_changelog_contains_openapi_version():
    spec_path = ROOT / "docs" / "03_api" / "openapi.yaml"
    changelog_path = ROOT / "docs" / "03_api" / "changelog.md"

    payload = yaml.safe_load(spec_path.read_text(encoding="utf-8"))
    version = payload["info"]["version"]
    changelog = changelog_path.read_text(encoding="utf-8")
    assert f"## {version} - " in changelog
