from __future__ import annotations

import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
OPENAPI_PATH = REPO_ROOT / "docs/03_api/openapi.yaml"
PILOT_ACTIONS_PATH = REPO_ROOT / "apps/app/actions/pilot.ts"
CANDIDATE_PAGE_PATH = REPO_ROOT / "apps/app/app/(candidate)/session/[id]/page.tsx"


def _require_markers(path: Path, markers: list[str]) -> None:
    if not path.exists():
        raise RuntimeError(f"demo-fixture-contract: missing file {path}")
    content = path.read_text(encoding="utf-8")
    for marker in markers:
        if marker not in content:
            raise RuntimeError(f"demo-fixture-contract: missing marker `{marker}` in {path}")


def main() -> int:
    _require_markers(
        OPENAPI_PATH,
        [
            "CaseGenerateRequest",
            "SessionScoreRequest",
            "/v1/cases/{case_id}/generate",
            "/v1/sessions/{session_id}/score",
        ],
    )
    _require_markers(
        PILOT_ACTIONS_PATH,
        [
            '{ mode: "fixture", template_id: templateId }',
            "demo_template_id: templateId",
        ],
    )
    _require_markers(
        CANDIDATE_PAGE_PATH,
        [
            "demo_template_id",
            "Demo Fixture Unavailable",
        ],
    )
    print("demo-fixture-contract: OK")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"demo-fixture-contract: FAIL ({exc})", file=sys.stderr)
        raise SystemExit(1)
