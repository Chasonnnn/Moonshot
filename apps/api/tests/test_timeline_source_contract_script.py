from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def test_timeline_source_contract_script_exists_and_checks_markers():
    script_path = ROOT / "apps" / "api" / "scripts" / "check_timeline_source_contract.py"
    assert script_path.exists()

    content = script_path.read_text(encoding="utf-8")
    assert "apps/app/actions/reports.ts" in content
    assert "MOONSHOT_ALLOW_FIXTURE_TIMELINE" in content
    assert "timeline_source" in content
    assert "timeline_warning" in content
