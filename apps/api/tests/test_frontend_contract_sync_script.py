from pathlib import Path


def test_frontend_contract_sync_script_exists_and_checks_version_lock():
    script_path = Path("/Users/chason/Moonshot/apps/api/scripts/check_frontend_contract_sync.py")
    assert script_path.exists()

    content = script_path.read_text(encoding="utf-8")
    assert "docs/03_api/openapi.yaml" in content
    assert "docs/08_frontend_contract/frontend_backend_contract.md" in content
    assert "docs/00_mvp/mvp_scope.md" in content
    assert "/v1/reports/{session_id}/summary" in content
    assert "current_step" in content
    assert "failed_step" in content
