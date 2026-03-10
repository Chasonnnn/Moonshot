from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]


def test_oral_response_migration_exists_and_creates_table():
    versions_dir = ROOT / "apps" / "api" / "alembic" / "versions"
    candidates = sorted(versions_dir.glob("*_0015_oral_responses.py"))
    assert candidates, "expected migration *_0015_oral_responses.py"

    content = candidates[-1].read_text(encoding="utf-8")
    assert "oral_responses" in content
    assert "create_table" in content
    assert "create_index" in content
