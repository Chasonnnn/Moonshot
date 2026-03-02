from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def test_seed_demo_script_supports_modes_and_outputs():
    script_path = ROOT / "apps" / "api" / "scripts" / "seed_demo.py"
    assert script_path.exists()

    content = script_path.read_text(encoding="utf-8")
    assert "--mode" in content
    assert "fixture" in content
    assert "fresh" in content
    assert "both" in content
    assert "manifest" in content
    assert "replay" in content
    assert "/v1/cases" in content


def test_seed_demo_script_reads_jda_fixture():
    script_path = ROOT / "apps" / "api" / "scripts" / "seed_demo.py"
    content = script_path.read_text(encoding="utf-8")

    assert "jda_seed_scenarios.json" in content
    assert "scenarios" in content
