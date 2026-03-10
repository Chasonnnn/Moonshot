from __future__ import annotations

import json
import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.services.memory_eval import run_memory_benchmark_fixture


def main() -> int:
    default_path = API_ROOT / "fixtures" / "memory_benchmark.json"
    fixture_path = Path(sys.argv[1]) if len(sys.argv) > 1 else default_path
    result = run_memory_benchmark_fixture(fixture_path)
    print(json.dumps(result, indent=2))
    return 0 if result["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
