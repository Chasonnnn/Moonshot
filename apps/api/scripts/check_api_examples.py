from __future__ import annotations

import json
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
EXAMPLES_PATH = REPO_ROOT / "apps" / "api" / "fixtures" / "api_examples.json"

REQUIRED_EXAMPLES = [
    "auth_token",
    "generate_case_submit",
    "score_session_submit",
    "export_submit",
    "quality_evaluate_submit",
    "interpretation_submit",
    "fairness_smoke_submit",
    "job_result_export_completed",
]

REQUIRED_ERROR_EXAMPLES = [
    "error_missing_idempotency_key",
    "error_invalid_bootstrap_token",
    "error_forbidden",
    "error_not_found",
]


def _expect(mapping: dict, key: str) -> dict:
    item = mapping.get(key)
    if not isinstance(item, dict):
        raise RuntimeError(f"api-examples: missing object example `{key}`")
    return item


def main() -> int:
    if not EXAMPLES_PATH.exists():
        raise RuntimeError(f"api-examples: missing fixture file at {EXAMPLES_PATH}")

    payload = json.loads(EXAMPLES_PATH.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise RuntimeError("api-examples: fixture root must be a JSON object")

    for key in REQUIRED_EXAMPLES:
        _expect(payload, key)

    for key in REQUIRED_ERROR_EXAMPLES:
        error_example = _expect(payload, key)
        for required in ("detail", "error_code", "error_detail", "request_id"):
            if required not in error_example:
                raise RuntimeError(f"api-examples: `{key}` missing `{required}`")

    export_completed = _expect(payload, "job_result_export_completed")
    response = _expect(export_completed, "response")
    result = _expect(response, "result")
    for required in ("run_id", "schema_version", "csv_headers", "csv", "json", "tableau_schema"):
        if required not in result:
            raise RuntimeError(f"api-examples: export result missing `{required}`")
    if result.get("schema_version") != "1.0.0":
        raise RuntimeError("api-examples: export schema_version must be `1.0.0`")
    if not isinstance(result.get("csv_headers"), list) or not result["csv_headers"]:
        raise RuntimeError("api-examples: export `csv_headers` must be a non-empty list")

    print("api-examples: OK")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"api-examples: FAIL ({exc})", file=sys.stderr)
        raise SystemExit(1)
