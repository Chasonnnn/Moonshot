from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def test_startup_script_runs_migrations_before_server_start():
    script_path = ROOT / "apps" / "api" / "scripts" / "start_api.sh"
    assert script_path.exists()

    content = script_path.read_text(encoding="utf-8")
    assert "validate_runtime_env.py" in content
    assert "guard_postgres_migration_target.py" in content
    assert "alembic" in content
    assert "upgrade head" in content
    assert "uvicorn" in content
