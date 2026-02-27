from pathlib import Path


def test_export_schema_script_exists_and_checks_contract():
    script_path = Path("/Users/chason/Moonshot/apps/api/scripts/check_export_schema.py")
    assert script_path.exists()

    content = script_path.read_text(encoding="utf-8")
    assert "openapi.yaml" in content
    assert "api_examples.json" in content
    assert "schema_version" in content
    assert "csv_headers" in content
