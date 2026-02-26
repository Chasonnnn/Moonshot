from pathlib import Path
import json

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "jda_seed_scenarios.json"


def main() -> None:
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    print(json.dumps({"seeded": len(data.get("scenarios", []))}, indent=2))


if __name__ == "__main__":
    main()
