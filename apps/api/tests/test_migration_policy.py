import pytest

from app.core.migration_policy import assert_postgres_migration_url


def test_migration_policy_accepts_postgres_urls():
    assert_postgres_migration_url("postgresql+psycopg://user:pass@localhost:5432/moonshot")
    assert_postgres_migration_url("postgresql://user:pass@localhost:5432/moonshot")
    assert_postgres_migration_url("postgres://user:pass@localhost:5432/moonshot")


def test_migration_policy_rejects_sqlite_urls():
    with pytest.raises(RuntimeError, match="Postgres-only migrations"):
        assert_postgres_migration_url("sqlite+pysqlite:////tmp/moonshot.db")


def test_migration_policy_requires_database_url():
    with pytest.raises(RuntimeError, match="MOONSHOT_DATABASE_URL must be set"):
        assert_postgres_migration_url("")
