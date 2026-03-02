from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]


def test_python_history_migration_exists_and_creates_table():
    versions_dir = ROOT / "apps" / "api" / "alembic" / "versions"
    candidates = sorted(versions_dir.glob("*_0011_session_python_history.py"))
    assert candidates, "expected migration *_0011_session_python_history.py"

    content = candidates[-1].read_text(encoding="utf-8")
    assert "session_python_history" in content
    assert "create_table" in content
    assert "create_index" in content
