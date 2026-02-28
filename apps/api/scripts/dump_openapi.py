import sys
from pathlib import Path

import yaml

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.main import app


def main() -> None:
    payload = app.openapi()

    repo_root = Path(__file__).resolve().parents[3]
    yaml_target = repo_root / "docs" / "03_api" / "openapi.yaml"

    yaml_target.write_text(yaml.safe_dump(payload, sort_keys=False), encoding="utf-8")
    print(f"wrote {yaml_target}")


if __name__ == "__main__":
    main()
