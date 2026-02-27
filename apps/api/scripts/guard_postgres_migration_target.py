from __future__ import annotations

import os
import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.core.migration_policy import assert_postgres_migration_url


def main() -> int:
    database_url = os.getenv("MOONSHOT_DATABASE_URL", "")
    validated = assert_postgres_migration_url(database_url)
    print(f"migration-target: OK postgres ({validated.split('://', 1)[0]})")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"migration-target: FAIL ({exc})", file=sys.stderr)
        raise SystemExit(1)
