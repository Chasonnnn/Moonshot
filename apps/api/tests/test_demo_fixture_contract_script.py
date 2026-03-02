from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]


def test_demo_fixture_contract_script_exists_and_checks_markers():
    script_path = ROOT / "apps" / "api" / "scripts" / "check_demo_fixture_contract.py"
    assert script_path.exists()

    content = script_path.read_text(encoding="utf-8")
    assert "CaseGenerateRequest" in content
    assert "SessionScoreRequest" in content
    assert 'mode: "fixture"' in content
    assert "demo_template_id" in content
    assert "Demo Fixture Unavailable" in content
