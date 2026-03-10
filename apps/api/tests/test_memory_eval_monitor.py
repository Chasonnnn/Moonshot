from pathlib import Path

from app.services.memory_eval import run_memory_benchmark_fixture


def test_memory_eval_passes_for_default_fixture():
    fixture_path = Path(__file__).resolve().parents[1] / "fixtures" / "memory_benchmark.json"
    benchmark = run_memory_benchmark_fixture(fixture_path)
    assert benchmark["pass"] is True
    assert benchmark["checked_cases"] >= 3
    assert benchmark["retrieval_precision_avg"] >= 0.9
    assert benchmark["retrieval_recall_avg"] >= 0.9
    assert benchmark["grounding_coverage_avg"] >= 0.9
    assert benchmark["grounding_leakage_count"] == 0


def test_memory_eval_detects_expected_retrieval_regression():
    fixture_path = Path(__file__).resolve().parents[1] / "fixtures" / "memory_benchmark.json"
    payload = fixture_path.read_text(encoding="utf-8")
    mutated = payload.replace(
        "\"00000000-0000-0000-0000-000000000102\"",
        "\"00000000-0000-0000-0000-000000009999\"",
        1,
    )
    temp_fixture = fixture_path.with_name("memory_benchmark_temp_recall_regression.json")
    temp_fixture.write_text(mutated, encoding="utf-8")
    try:
        result = run_memory_benchmark_fixture(temp_fixture)
        assert result["pass"] is False
        assert result["retrieval_regression_count"] >= 1
    finally:
        temp_fixture.unlink(missing_ok=True)


def test_memory_eval_detects_grounding_leakage():
    fixture_path = Path(__file__).resolve().parents[1] / "fixtures" / "memory_benchmark.json"
    payload = fixture_path.read_text(encoding="utf-8")
    mutated = payload.replace(
        "\"reviewer-only note\"",
        "\"instrumentation drift\"",
        1,
    )
    temp_fixture = fixture_path.with_name("memory_benchmark_temp_grounding_leakage.json")
    temp_fixture.write_text(mutated, encoding="utf-8")
    try:
        result = run_memory_benchmark_fixture(temp_fixture)
        assert result["pass"] is False
        assert result["grounding_leakage_count"] >= 1
    finally:
        temp_fixture.unlink(missing_ok=True)
