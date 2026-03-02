from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def test_contract_sync_script_exists_and_checks_openapi_docs_alignment():
    script_path = ROOT / "apps" / "api" / "scripts" / "check_openapi_sync.py"
    assert script_path.exists()

    content = script_path.read_text(encoding="utf-8")
    assert "docs/03_api/openapi.yaml" in content
    assert "openapi.json" in content
    assert "openapi-sync" in content
