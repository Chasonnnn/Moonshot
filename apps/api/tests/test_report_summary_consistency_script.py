from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def test_report_summary_consistency_script_has_required_checks():
    script_path = ROOT / "apps" / "api" / "scripts" / "check_report_summary_consistency.py"
    assert script_path.exists()

    content = script_path.read_text(encoding="utf-8")
    assert "report_summary_response" in content
    assert "job_result_score_completed" in content
    assert "trigger_count" in content
    assert "last_scored_at" in content
    assert "scoring_version_lock" in content
