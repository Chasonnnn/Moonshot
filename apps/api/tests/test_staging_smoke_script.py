from pathlib import Path


def test_staging_smoke_script_exists_with_core_steps():
    script_path = Path("/Users/chason/Moonshot/apps/api/scripts/staging_smoke.py")
    assert script_path.exists()

    content = script_path.read_text(encoding="utf-8")
    assert "/health" in content
    assert "/v1/meta/version" in content
    assert "/v1/auth/token" in content
    assert "/v1/cases" in content
    assert "/v1/jobs/" in content
