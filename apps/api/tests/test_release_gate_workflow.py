from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def test_api_ci_workflow_has_strict_release_gates():
    workflow_path = ROOT / ".github" / "workflows" / "api-ci.yml"
    content = workflow_path.read_text(encoding="utf-8")

    assert "check_contract_governance.py" in content
    assert "check_openapi_sync.py" in content
    assert "check_frontend_contract_sync.py" in content
    assert "check_score_drift.py" in content
    assert "staging_smoke.py" in content
    assert "load_pilot.py" in content
    assert "check_api_examples.py" in content
    assert "check_export_schema.py" in content
    assert "check_report_summary_consistency.py" in content
    assert "guard_postgres_migration_target.py" in content
    assert "alembic" in content
    assert "postgres" in content
    assert "upload-artifact@v4" in content
    assert "staging-smoke.log" in content
    assert "load-pilot.log" in content
