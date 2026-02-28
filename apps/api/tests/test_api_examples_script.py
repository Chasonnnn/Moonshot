from pathlib import Path


def test_api_examples_script_exists_and_enforces_flow_examples():
    script_path = Path("/Users/chason/Moonshot/apps/api/scripts/check_api_examples.py")
    assert script_path.exists()

    content = script_path.read_text(encoding="utf-8")
    assert "api_examples.json" in content
    assert "quality_evaluate_submit" in content
    assert "interpretation_submit" in content
    assert "fairness_smoke_submit" in content
    assert "report_summary_response" in content
    assert "policy_decision_code" in content
    assert "trigger_impacts" in content
    assert "job_status_pending" in content
    assert "current_step" in content
    assert "failed_step" in content
    assert "grounding_coverage_score" in content
    assert "error_missing_idempotency_key" in content
