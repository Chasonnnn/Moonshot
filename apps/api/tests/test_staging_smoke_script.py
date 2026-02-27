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


def test_staging_smoke_script_covers_jda_e2e_flow():
    script_path = Path("/Users/chason/Moonshot/apps/api/scripts/staging_smoke.py")
    content = script_path.read_text(encoding="utf-8")

    assert "/v1/task-families/" in content
    assert "/review" in content
    assert "/publish" in content
    assert "/v1/sessions" in content
    assert "/events" in content
    assert "/coach/message" in content
    assert "/submit" in content
    assert "/score" in content
    assert "/v1/reports/" in content
    assert "/v1/exports" in content
    assert "/v1/redteam/runs" in content
    assert "/v1/audit-logs" in content
    assert "/v1/slo/probes" in content
