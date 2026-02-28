from __future__ import annotations

import json
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
EXAMPLES_PATH = REPO_ROOT / "apps" / "api" / "fixtures" / "api_examples.json"


def main() -> int:
    payload = json.loads(EXAMPLES_PATH.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise RuntimeError("report-summary-consistency: fixture root must be object")

    summary = payload["report_summary_response"]["response"]
    score_result = payload["job_result_score_completed"]["response"]["result"]

    if summary["confidence"] != score_result["confidence"]:
        raise RuntimeError("report-summary-consistency: confidence mismatch")
    if summary["needs_human_review"] != score_result["needs_human_review"]:
        raise RuntimeError("report-summary-consistency: needs_human_review mismatch")
    if summary["trigger_codes"] != score_result["trigger_codes"]:
        raise RuntimeError("report-summary-consistency: trigger_codes mismatch")
    if summary["trigger_count"] != len(score_result["trigger_codes"]):
        raise RuntimeError("report-summary-consistency: trigger_count mismatch")
    if summary["last_scored_at"] != score_result["scored_at"]:
        raise RuntimeError("report-summary-consistency: scored_at mismatch")

    lock = summary["scoring_version_lock"]
    for key in ("scorer_version", "rubric_version", "task_family_version", "model_hash"):
        if lock[key] != score_result[key]:
            raise RuntimeError(f"report-summary-consistency: {key} mismatch")

    print("report-summary-consistency: OK")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"report-summary-consistency: FAIL ({exc})", file=sys.stderr)
        raise SystemExit(1)
