from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any
from uuid import uuid4

import requests

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "jda_seed_scenarios.json"


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
    payload = _require_ok(
        requests.post(
            f"{base_url}/v1/auth/token",
            headers={"X-Bootstrap-Token": bootstrap_token},
            json={"role": role, "user_id": user_id, "tenant_id": tenant_id, "expires_in_seconds": 3600},
            timeout=10,
        ),
        step=f"issue_token_{role}",
        expected_status=201,
    )
    return str(payload["access_token"])


def _poll_job(base_url: str, token: str, job_id: str, max_polls: int, interval_seconds: float) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {token}"}
    for _ in range(max_polls):
        status_response = requests.get(f"{base_url}/v1/jobs/{job_id}", headers=headers, timeout=10)
        status_payload = _require_ok(status_response, step="job_status", expected_status=200)
        status_value = str(status_payload["status"])
        if status_value in {"completed", "failed_permanent"}:
            result_response = requests.get(f"{base_url}/v1/jobs/{job_id}/result", headers=headers, timeout=10)
            return _require_ok(result_response, step="job_result", expected_status=200)
        time.sleep(interval_seconds)
    raise RuntimeError(f"job polling timeout for job_id={job_id}")


def _create_case(
    *,
    base_url: str,
    token: str,
    title: str,
    scenario: str,
    artifacts: list[dict[str, Any]],
) -> str:
    payload = _require_ok(
        requests.post(
            f"{base_url}/v1/cases",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "title": title,
                "scenario": scenario,
                "artifacts": artifacts,
                "metrics": [],
                "allowed_tools": ["sql_workspace", "dashboard_workspace", "copilot"],
            },
            timeout=10,
        ),
        step="create_case",
        expected_status=201,
    )
    return str(payload["id"])


def _generate_review_publish(
    *,
    base_url: str,
    admin_token: str,
    reviewer_token: str,
    case_id: str,
    idempotency_seed: str,
    max_polls: int,
    poll_interval: float,
) -> str:
    submit = _require_ok(
        requests.post(
            f"{base_url}/v1/cases/{case_id}/generate",
            headers={"Authorization": f"Bearer {admin_token}", "Idempotency-Key": f"seed-{idempotency_seed}-{uuid4().hex}"},
            timeout=10,
        ),
        step="submit_generate",
        expected_status=202,
    )
    result = _poll_job(base_url, admin_token, str(submit["job_id"]), max_polls, poll_interval)
    if str(result.get("status")) != "completed":
        raise RuntimeError(f"generate job failed for case_id={case_id}: {result.get('result')}")

    task_family_id = str(result.get("result", {}).get("task_family", {}).get("id", ""))
    if not task_family_id:
        raise RuntimeError(f"generate job missing task family id for case_id={case_id}")

    _require_ok(
        requests.post(
            f"{base_url}/v1/task-families/{task_family_id}/review",
            headers={"Authorization": f"Bearer {reviewer_token}"},
            json={"decision": "approve", "review_note": "seed demo approve"},
            timeout=10,
        ),
        step="review_task_family",
        expected_status=200,
    )
    _require_ok(
        requests.post(
            f"{base_url}/v1/task-families/{task_family_id}/publish",
            headers={"Authorization": f"Bearer {reviewer_token}"},
            json={"approver_note": "seed demo publish"},
            timeout=10,
        ),
        step="publish_task_family",
        expected_status=200,
    )
    return task_family_id


def _load_fixture() -> list[dict[str, Any]]:
    payload = json.loads(FIXTURE.read_text(encoding="utf-8"))
    scenarios = payload.get("scenarios", [])
    if not isinstance(scenarios, list):
        raise RuntimeError("fixture malformed: scenarios must be a list")
    return scenarios


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed Moonshot demo scenarios and emit regression manifest/replay files.")
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--bootstrap-token", default="moonshot-bootstrap-dev")
    parser.add_argument("--tenant-id", default="tenant_demo")
    parser.add_argument("--admin-user-id", default="seed_admin")
    parser.add_argument("--reviewer-user-id", default="seed_reviewer")
    parser.add_argument("--mode", choices=["fixture", "fresh", "both"], default="both")
    parser.add_argument("--output", default="/tmp/moonshot_seed_manifest.json")
    parser.add_argument("--replay-output", default=None)
    parser.add_argument("--max-polls", type=int, default=60)
    parser.add_argument("--poll-interval", type=float, default=0.5)
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    output_path = Path(args.output).resolve()
    replay_path = Path(args.replay_output).resolve() if args.replay_output else output_path.with_name(f"{output_path.stem}_replay.json")

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

    fixture_rows = _load_fixture()
    entries: list[dict[str, Any]] = []

    if args.mode in {"fixture", "both"}:
        for row in fixture_rows:
            scenario_id = str(row.get("id", "fixture_unknown"))
            title = str(row.get("title", "Fixture Scenario"))
            scenario = str(row.get("prompt", "Analyze provided artifacts and provide evidence-based conclusions."))
            artifact_names = row.get("artifacts", [])
            artifacts = [{"type": "file", "name": str(name)} for name in artifact_names] if isinstance(artifact_names, list) else []

            case_id = _create_case(
                base_url=base_url,
                token=admin_token,
                title=f"[Fixture:{scenario_id}] {title}",
                scenario=scenario,
                artifacts=artifacts,
            )
            task_family_id = _generate_review_publish(
                base_url=base_url,
                admin_token=admin_token,
                reviewer_token=reviewer_token,
                case_id=case_id,
                idempotency_seed=f"fixture-{scenario_id}",
                max_polls=args.max_polls,
                poll_interval=args.poll_interval,
            )
            entries.append(
                {
                    "source": "fixture",
                    "scenario_id": scenario_id,
                    "title": title,
                    "case_id": case_id,
                    "task_family_id": task_family_id,
                    "status": "published",
                }
            )

    if args.mode in {"fresh", "both"}:
        fresh_case_id = _create_case(
            base_url=base_url,
            token=admin_token,
            title=f"Fresh Demo Case {int(time.time())}",
            scenario="Investigate KPI regression and recommend an escalation decision with explicit caveats.",
            artifacts=[{"type": "csv", "name": "fresh_scenario.csv"}],
        )
        fresh_task_family_id = _generate_review_publish(
            base_url=base_url,
            admin_token=admin_token,
            reviewer_token=reviewer_token,
            case_id=fresh_case_id,
            idempotency_seed="fresh",
            max_polls=args.max_polls,
            poll_interval=args.poll_interval,
        )
        entries.append(
            {
                "source": "fresh",
                "scenario_id": "fresh_generated",
                "title": "Fresh generated scenario",
                "case_id": fresh_case_id,
                "task_family_id": fresh_task_family_id,
                "status": "published",
            }
        )

    manifest_payload = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "mode": args.mode,
        "tenant_id": args.tenant_id,
        "fixture_path": str(FIXTURE),
        "entries": entries,
    }
    replay_payload = {
        "tenant_id": args.tenant_id,
        "mode": args.mode,
        "scenario_order": [entry["scenario_id"] for entry in entries],
        "case_ids": [entry["case_id"] for entry in entries],
        "task_family_ids": [entry["task_family_id"] for entry in entries],
    }

    _write_json(output_path, manifest_payload)
    _write_json(replay_path, replay_payload)

    print(
        json.dumps(
            {
                "manifest": str(output_path),
                "replay": str(replay_path),
                "seeded": len(entries),
                "mode": args.mode,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"seed-demo: FAIL ({exc})", file=sys.stderr)
        raise SystemExit(1)
