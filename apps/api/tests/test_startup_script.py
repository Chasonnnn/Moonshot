from pathlib import Path


def test_startup_script_runs_migrations_before_server_start():
    script_path = Path("/Users/chason/Moonshot/apps/api/scripts/start_api.sh")
    assert script_path.exists()

    content = script_path.read_text(encoding="utf-8")
    assert "guard_postgres_migration_target.py" in content
    assert "alembic" in content
    assert "upgrade head" in content
    assert "uvicorn" in content
