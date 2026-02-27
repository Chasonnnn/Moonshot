from __future__ import annotations

import argparse
import sys
import time
from typing import Any

import requests


def _require_ok(response: requests.Response, *, step: str, expected_status: int) -> dict[str, Any]:
    if response.status_code != expected_status:
        raise RuntimeError(
            f"{step} failed: status={response.status_code} expected={expected_status} body={response.text[:500]}"
        )
    payload = response.json()
    if not isinstance(payload, dict):
        raise RuntimeError(f"{step} failed: expected JSON object response")
    return payload


def _poll_job(base_url: str, token: str, job_id: str, max_polls: int, interval_seconds: float) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {token}"}
    for _ in range(max_polls):
        status_response = requests.get(f"{base_url}/v1/jobs/{job_id}", headers=headers, timeout=10)
        status_payload = _require_ok(status_response, step="job_status", expected_status=200)
        if status_payload["status"] in {"completed", "failed_permanent"}:
            result_response = requests.get(f"{base_url}/v1/jobs/{job_id}/result", headers=headers, timeout=10)
            return _require_ok(result_response, step="job_result", expected_status=200)
        time.sleep(interval_seconds)
    raise RuntimeError(f"job polling timeout for job_id={job_id}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Run staging smoke checks against Moonshot API.")
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--bootstrap-token", default="moonshot-bootstrap-dev")
    parser.add_argument("--tenant-id", default="tenant_smoke")
    parser.add_argument("--user-id", default="smoke_admin")
    parser.add_argument("--max-polls", type=int, default=40)
    parser.add_argument("--poll-interval", type=float, default=0.5)
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")

    _require_ok(requests.get(f"{base_url}/health", timeout=10), step="health", expected_status=200)
    _require_ok(requests.get(f"{base_url}/v1/meta/version", timeout=10), step="meta_version", expected_status=200)

    token_payload = _require_ok(
        requests.post(
            f"{base_url}/v1/auth/token",
            headers={"X-Bootstrap-Token": args.bootstrap_token},
            json={"role": "org_admin", "user_id": args.user_id, "tenant_id": args.tenant_id, "expires_in_seconds": 3600},
            timeout=10,
        ),
        step="issue_token",
        expected_status=201,
    )
    token = str(token_payload["access_token"])
    auth_headers = {"Authorization": f"Bearer {token}"}

    case_payload = _require_ok(
        requests.post(
            f"{base_url}/v1/cases",
            headers=auth_headers,
            json={
                "title": "Staging Smoke Case",
                "scenario": "Validate staging path end-to-end.",
                "artifacts": [],
                "metrics": [],
                "allowed_tools": ["sql_workspace"],
            },
            timeout=10,
        ),
        step="create_case",
        expected_status=201,
    )
    case_id = str(case_payload["id"])

    generate_submit = _require_ok(
        requests.post(
            f"{base_url}/v1/cases/{case_id}/generate",
            headers={**auth_headers, "Idempotency-Key": "staging-smoke-generate-1"},
            timeout=10,
        ),
        step="submit_generate_job",
        expected_status=202,
    )
    generate_result = _poll_job(
        base_url,
        token,
        str(generate_submit["job_id"]),
        max_polls=args.max_polls,
        interval_seconds=args.poll_interval,
    )
    if str(generate_result.get("status")) != "completed":
        raise RuntimeError("generate job did not complete successfully")

    print("staging smoke: PASS")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"staging smoke: FAIL ({exc})", file=sys.stderr)
        raise SystemExit(1)
