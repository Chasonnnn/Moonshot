from __future__ import annotations


def assert_postgres_migration_url(database_url: str) -> str:
    normalized = (database_url or "").strip()
    if not normalized:
        raise RuntimeError("MOONSHOT_DATABASE_URL must be set for migrations")

    lowered = normalized.lower()
    if lowered.startswith("sqlite"):
        raise RuntimeError(
            "Postgres-only migrations: sqlite migration targets are not supported. "
            "Use a postgresql:// or postgresql+psycopg:// MOONSHOT_DATABASE_URL."
        )
    if not (lowered.startswith("postgresql://") or lowered.startswith("postgresql+") or lowered.startswith("postgres://")):
        raise RuntimeError(
            "Postgres-only migrations: unsupported migration database URL. "
            "Use a postgresql:// or postgresql+psycopg:// MOONSHOT_DATABASE_URL."
        )
    return normalized
