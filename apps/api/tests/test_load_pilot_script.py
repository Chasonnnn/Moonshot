from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def test_load_pilot_script_exists_with_p95_gate():
    script_path = ROOT / "apps" / "api" / "scripts" / "load_pilot.py"
    assert script_path.exists()

    content = script_path.read_text(encoding="utf-8")
    assert "p95" in content
    assert "--max-p95-ms" in content
    assert "/v1/meta/version" in content
    assert "/v1/sessions" in content
