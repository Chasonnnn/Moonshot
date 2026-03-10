from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]


def test_score_result_overall_score_migration_exists_and_adds_column():
    versions_dir = ROOT / "apps" / "api" / "alembic" / "versions"
    candidates = sorted(versions_dir.glob("*_0016_score_results_overall_score.py"))
    assert candidates, "expected migration *_0016_score_results_overall_score.py"

    content = candidates[-1].read_text(encoding="utf-8")
    assert "score_results" in content
    assert "overall_score" in content
    assert "add_column" in content
