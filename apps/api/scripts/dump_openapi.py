from pathlib import Path
import json

from app.main import app


def main() -> None:
    target = Path(__file__).resolve().parents[2] / "docs" / "03_api" / "openapi.generated.json"
    target.write_text(json.dumps(app.openapi(), indent=2), encoding="utf-8")
    print(f"wrote {target}")


if __name__ == "__main__":
    main()
