from pathlib import Path

from app.services.score_drift import evaluate_drift, run_benchmark_fixture


def test_drift_monitor_passes_for_default_fixture():
    fixture_path = Path(__file__).resolve().parents[1] / "fixtures" / "scoring_benchmark.json"
    benchmark = run_benchmark_fixture(fixture_path)
    assert benchmark["pass"] is True
    assert benchmark["checked_cases"] >= 1
    assert benchmark["drift_count"] == 0


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
