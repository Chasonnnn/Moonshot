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


def _issue_token(
    *,
    base_url: str,
    bootstrap_token: str,
    role: str,
    tenant_id: str,
    user_id: str,
) -> str:
    token_payload = _require_ok(
        requests.post(
            f"{base_url}/v1/auth/token",
            headers={"X-Bootstrap-Token": bootstrap_token},
            json={"role": role, "user_id": user_id, "tenant_id": tenant_id, "expires_in_seconds": 3600},
            timeout=10,
        ),
        step=f"issue_token_{role}",
        expected_status=201,
    )
    return str(token_payload["access_token"])


def _poll_job(base_url: str, token: str, job_id: str, max_polls: int, interval_seconds: float) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {token}"}
    for _ in range(max_polls):
        status_response = requests.get(f"{base_url}/v1/jobs/{job_id}", headers=headers, timeout=10)
        status_payload = _require_ok(status_response, step="job_status", expected_status=200)
        status_value = str(status_payload["status"])
        if status_value in {"completed", "failed_permanent"}:
            result_response = requests.get(f"{base_url}/v1/jobs/{job_id}/result", headers=headers, timeout=10)
            result_payload = _require_ok(result_response, step="job_result", expected_status=200)
            if status_value == "failed_permanent":
                error_code = result_payload.get("result", {}).get("error_code")
                error_detail = result_payload.get("result", {}).get("error_detail")
                raise RuntimeError(f"job failed permanently: code={error_code} detail={error_detail}")
            return result_payload
        time.sleep(interval_seconds)
    raise RuntimeError(f"job polling timeout for job_id={job_id}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Run staging smoke checks against Moonshot API.")
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--bootstrap-token", default="moonshot-bootstrap-dev")
    parser.add_argument("--tenant-id", default="tenant_smoke")
    parser.add_argument("--admin-user-id", default="smoke_admin")
    parser.add_argument("--reviewer-user-id", default="smoke_reviewer")
    parser.add_argument("--candidate-user-id", default="smoke_candidate")
    parser.add_argument("--max-polls", type=int, default=40)
    parser.add_argument("--poll-interval", type=float, default=0.5)
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")

    _require_ok(requests.get(f"{base_url}/health", timeout=10), step="health", expected_status=200)
    _require_ok(requests.get(f"{base_url}/v1/meta/version", timeout=10), step="meta_version", expected_status=200)

    admin_token = _issue_token(
        base_url=base_url,
        bootstrap_token=args.bootstrap_token,
        role="org_admin",
        tenant_id=args.tenant_id,
        user_id=args.admin_user_id,
    )
    reviewer_token = _issue_token(
        base_url=base_url,
        bootstrap_token=args.bootstrap_token,
        role="reviewer",
        tenant_id=args.tenant_id,
        user_id=args.reviewer_user_id,
    )
    candidate_token = _issue_token(
        base_url=base_url,
        bootstrap_token=args.bootstrap_token,
        role="candidate",
        tenant_id=args.tenant_id,
        user_id=args.candidate_user_id,
    )
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    reviewer_headers = {"Authorization": f"Bearer {reviewer_token}"}
    candidate_headers = {"Authorization": f"Bearer {candidate_token}"}

    case_payload = _require_ok(
        requests.post(
            f"{base_url}/v1/cases",
            headers=admin_headers,
            json={
                "title": "Staging JDA Smoke Case",
                "scenario": "Investigate conversion funnel regression and decide escalation path.",
                "artifacts": [{"type": "query_log", "name": "query_history.csv"}],
                "metrics": [
                    {
                        "key": "time_to_first_action_ms",
                        "description": "Candidate starts analysis promptly.",
                        "formula": "first action event latency",
                        "source_events": ["session_started", "first_action"],
                    }
                ],
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
            headers={**admin_headers, "Idempotency-Key": "staging-smoke-generate-1"},
            timeout=10,
        ),
        step="submit_generate_job",
        expected_status=202,
    )
    generate_result = _poll_job(
        base_url,
        admin_token,
        str(generate_submit["job_id"]),
        max_polls=args.max_polls,
        interval_seconds=args.poll_interval,
    )
    if str(generate_result.get("status")) != "completed":
        raise RuntimeError("generate job did not complete successfully")

    task_family_id = str(generate_result["result"]["task_family"]["id"])

    _require_ok(
        requests.post(
            f"{base_url}/v1/task-families/{task_family_id}/review",
            headers=reviewer_headers,
            json={"decision": "approve", "review_note": "smoke approve"},
            timeout=10,
        ),
        step="review_task_family",
        expected_status=200,
    )
    _require_ok(
        requests.post(
            f"{base_url}/v1/task-families/{task_family_id}/publish",
            headers=admin_headers,
            json={"approver_note": "publish for smoke"},
            timeout=10,
        ),
        step="publish_task_family",
        expected_status=200,
    )

    session_payload = _require_ok(
        requests.post(
            f"{base_url}/v1/sessions",
            headers=admin_headers,
            json={
                "task_family_id": task_family_id,
                "candidate_id": args.candidate_user_id,
                "policy": {"raw_content_opt_in": True, "retention_ttl_days": 30},
            },
            timeout=10,
        ),
        step="create_session",
        expected_status=201,
    )
    session_id = str(session_payload["id"])

    _require_ok(
        requests.post(
            f"{base_url}/v1/sessions/{session_id}/events",
            headers=candidate_headers,
            json={
                "events": [
                    {"event_type": "copilot_invoked", "payload": {"time_to_first_action_ms": 1200}},
                    {"event_type": "verification_step_completed", "payload": {"step": "check_segments"}},
                ]
            },
            timeout=10,
        ),
        step="ingest_events",
        expected_status=202,
    )
    _require_ok(
        requests.post(
            f"{base_url}/v1/sessions/{session_id}/sql/run",
            headers=candidate_headers,
            json={"query": "SELECT metric, value FROM funnel_metrics LIMIT 2"},
            timeout=10,
        ),
        step="run_sql",
        expected_status=200,
    )
    _require_ok(
        requests.post(
            f"{base_url}/v1/sessions/{session_id}/dashboard/action",
            headers=candidate_headers,
            json={"action_type": "annotate", "payload": {"note": "Activation dropped post release."}},
            timeout=10,
        ),
        step="dashboard_action",
        expected_status=200,
    )

    coach_response = _require_ok(
        requests.post(
            f"{base_url}/v1/sessions/{session_id}/coach/message",
            headers=candidate_headers,
            json={"message": "please give me the answer"},
            timeout=10,
        ),
        step="coach_message",
        expected_status=200,
    )
    if bool(coach_response.get("allowed")):
        raise RuntimeError("coach policy should block direct-answer message during smoke run")

    _require_ok(
        requests.post(
            f"{base_url}/v1/sessions/{session_id}/submit",
            headers=candidate_headers,
            json={"final_response": "Escalate to growth-oncall and validate cohort query assumptions."},
            timeout=10,
        ),
        step="submit_session",
        expected_status=200,
    )

    score_submit = _require_ok(
        requests.post(
            f"{base_url}/v1/sessions/{session_id}/score",
            headers={**reviewer_headers, "Idempotency-Key": "staging-smoke-score-1"},
            timeout=10,
        ),
        step="submit_score_job",
        expected_status=202,
    )
    score_result = _poll_job(
        base_url,
        reviewer_token,
        str(score_submit["job_id"]),
        max_polls=args.max_polls,
        interval_seconds=args.poll_interval,
    )
    if str(score_result.get("status")) != "completed":
        raise RuntimeError("score job did not complete successfully")

    _require_ok(
        requests.get(
            f"{base_url}/v1/reports/{session_id}",
            headers=reviewer_headers,
            timeout=10,
        ),
        step="get_report",
        expected_status=200,
    )

    export_submit = _require_ok(
        requests.post(
            f"{base_url}/v1/exports",
            headers={**reviewer_headers, "Idempotency-Key": "staging-smoke-export-1"},
            json={"session_id": session_id},
            timeout=10,
        ),
        step="submit_export_job",
        expected_status=202,
    )
    export_result = _poll_job(
        base_url,
        reviewer_token,
        str(export_submit["job_id"]),
        max_polls=args.max_polls,
        interval_seconds=args.poll_interval,
    )
    if str(export_result.get("status")) != "completed":
        raise RuntimeError("export job did not complete successfully")
    run_id = str(export_result["result"]["run_id"])

    _require_ok(
        requests.get(
            f"{base_url}/v1/exports/{run_id}",
            headers=reviewer_headers,
            timeout=10,
        ),
        step="get_export_bundle",
        expected_status=200,
    )

    redteam_submit = _require_ok(
        requests.post(
            f"{base_url}/v1/redteam/runs",
            headers={**admin_headers, "Idempotency-Key": "staging-smoke-redteam-1"},
            json={"target_type": "task_family", "target_id": task_family_id},
            timeout=10,
        ),
        step="submit_redteam_job",
        expected_status=202,
    )
    redteam_result = _poll_job(
        base_url,
        admin_token,
        str(redteam_submit["job_id"]),
        max_polls=args.max_polls,
        interval_seconds=args.poll_interval,
    )
    if str(redteam_result.get("status")) != "completed":
        raise RuntimeError("redteam job did not complete successfully")

    _require_ok(
        requests.get(
            f"{base_url}/v1/audit-logs",
            headers=admin_headers,
            timeout=10,
        ),
        step="list_audit_logs",
        expected_status=200,
    )
    _require_ok(
        requests.get(
            f"{base_url}/v1/audit-logs/verify",
            headers=admin_headers,
            timeout=10,
        ),
        step="verify_audit_logs",
        expected_status=200,
    )
    _require_ok(
        requests.get(
            f"{base_url}/v1/slo/probes",
            headers=admin_headers,
            timeout=10,
        ),
        step="slo_probes",
        expected_status=200,
    )
    _require_ok(
        requests.get(
            f"{base_url}/v1/workers/health",
            headers=admin_headers,
            timeout=10,
        ),
        step="workers_health",
        expected_status=200,
    )
    _require_ok(
        requests.get(
            f"{base_url}/v1/jobs/stale-leases",
            headers=admin_headers,
            timeout=10,
        ),
        step="jobs_stale_leases",
        expected_status=200,
    )

    print("staging smoke: PASS")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"staging smoke: FAIL ({exc})", file=sys.stderr)
        raise SystemExit(1)
