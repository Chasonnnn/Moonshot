from __future__ import annotations

import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
REPORT_ACTIONS_PATH = REPO_ROOT / "apps/app/actions/reports.ts"

REQUIRED_MARKERS = [
    "MOONSHOT_ALLOW_FIXTURE_TIMELINE",
    "timeline_source",
    "timeline_warning",
    "listSessionEvents",
    "if (!fixtureTimelineEnabled())",
]


def main() -> int:
    if not REPORT_ACTIONS_PATH.exists():
        raise RuntimeError(f"timeline-source-contract: missing file {REPORT_ACTIONS_PATH}")

    content = REPORT_ACTIONS_PATH.read_text(encoding="utf-8")
    for marker in REQUIRED_MARKERS:
        if marker not in content:
            raise RuntimeError(f"timeline-source-contract: missing marker `{marker}`")

    print("timeline-source-contract: OK")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"timeline-source-contract: FAIL ({exc})", file=sys.stderr)
        raise SystemExit(1)
