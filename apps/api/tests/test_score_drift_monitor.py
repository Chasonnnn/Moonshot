from pathlib import Path

from app.services.score_drift import evaluate_drift, run_benchmark_fixture


def test_drift_monitor_passes_for_default_fixture():
    fixture_path = Path(__file__).resolve().parents[1] / "fixtures" / "scoring_benchmark.json"
    benchmark = run_benchmark_fixture(fixture_path)
    assert benchmark["pass"] is True
    assert benchmark["checked_cases"] >= 3
    assert benchmark["drift_count"] == 0
    assert benchmark["trigger_mismatch_count"] == 0
    assert benchmark["trigger_impact_mismatch_count"] == 0


def test_drift_monitor_detects_excessive_drift():
    baseline = {
        "case_a": {"confidence": 0.80, "dimension_scores": {"sql_quality": 0.78, "communication": 0.81}},
    }
    current = {
        "case_a": {"confidence": 0.40, "dimension_scores": {"sql_quality": 0.20, "communication": 0.40}},
    }
    result = evaluate_drift(baseline, current, confidence_delta_max=0.1, dimension_delta_max=0.15)
    assert result["pass"] is False
    assert result["drift_count"] >= 1


def test_drift_monitor_detects_trigger_mismatch():
    fixture_path = Path(__file__).resolve().parents[1] / "fixtures" / "scoring_benchmark.json"
    payload = fixture_path.read_text(encoding="utf-8")
    mutated = payload.replace("\"low_confidence\", \"high_ai_low_verification\"", "\"policy_violation\"")
    temp_fixture = fixture_path.with_name("scoring_benchmark_temp_trigger_mismatch.json")
    temp_fixture.write_text(mutated, encoding="utf-8")
    try:
        result = run_benchmark_fixture(temp_fixture)
        assert result["pass"] is False
        assert result["trigger_mismatch_count"] >= 1
    finally:
        temp_fixture.unlink(missing_ok=True)


def test_drift_monitor_detects_trigger_impact_mismatch():
    fixture_path = Path(__file__).resolve().parents[1] / "fixtures" / "scoring_benchmark.json"
    payload = fixture_path.read_text(encoding="utf-8")
    mutated = payload.replace("\"delta\": -0.2", "\"delta\": -0.35")
    temp_fixture = fixture_path.with_name("scoring_benchmark_temp_trigger_impact_mismatch.json")
    temp_fixture.write_text(mutated, encoding="utf-8")
    try:
        result = run_benchmark_fixture(temp_fixture)
        assert result["pass"] is False
        assert result["trigger_impact_mismatch_count"] >= 1
    finally:
        temp_fixture.unlink(missing_ok=True)
