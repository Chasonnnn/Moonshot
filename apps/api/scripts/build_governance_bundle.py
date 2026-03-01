from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def _require_ok(response: requests.Response, *, step: str, expected_status: int) -> dict[str, Any]:
    if response.status_code != expected_status:
        raise RuntimeError(
            f"{step} failed: status={response.status_code} expected={expected_status} body={response.text[:500]}"
        )
    payload = response.json()
    if not isinstance(payload, dict):
        raise RuntimeError(f"{step} failed: expected JSON object")
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


def _authed_get(base_url: str, token: str, path: str, *, step: str) -> dict[str, Any]:
    return _require_ok(
        requests.get(
            f"{base_url}{path}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        ),
        step=step,
        expected_status=200,
    )


def _authed_post(base_url: str, token: str, path: str, payload: dict[str, Any], *, step: str) -> dict[str, Any]:
    return _require_ok(
        requests.post(
            f"{base_url}{path}",
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
            timeout=10,
        ),
        step=step,
        expected_status=200,
    )


def _resolve_redteam_reference(
    *,
    base_url: str,
    admin_token: str,
    session_id: str,
    redteam_run_id: str | None,
) -> dict[str, Any] | None:
    if redteam_run_id:
        return _authed_get(base_url, admin_token, f"/v1/redteam/runs/{redteam_run_id}", step="get_redteam_run")

    # Uses /v1/redteam/runs/ read endpoint for fallback lookup when run id is not supplied.
    listing = _authed_get(
        base_url,
        admin_token,
        f"/v1/redteam/runs?target_type=session&target_id={session_id}",
        step="list_redteam_runs",
    )
    items = listing.get("items", [])
    if isinstance(items, list) and items:
        first = items[0]
        if isinstance(first, dict):
            return first
    return None


def _resolve_fairness_reference(
    *,
    base_url: str,
    admin_token: str,
    fairness_run_id: str | None,
) -> dict[str, Any] | None:
    # /v1/fairness/smoke-runs/{run_id} is only fetched when run id is supplied.
    if fairness_run_id is None:
        return None
    return _authed_get(
        base_url,
        admin_token,
        f"/v1/fairness/smoke-runs/{fairness_run_id}",
        step="get_fairness_smoke_run",
    )


def _build_markdown(payload: dict[str, Any]) -> str:
    session = payload["session"]
    report_summary = payload["report_summary"]
    report = payload["report"]
    scoring_lock = report_summary.get("scoring_version_lock") or {}
    governance = payload["governance"]

    lines = [
        "# Moonshot Governance Bundle",
        "",
        f"- Generated at: {payload['generated_at']}",
        f"- Tenant: {payload['tenant_id']}",
        f"- Session: {session.get('id')}",
        "",
        "## Session Policy",
        f"- raw_content_opt_in: {session.get('policy', {}).get('raw_content_opt_in')}",
        f"- retention_ttl_days: {session.get('policy', {}).get('retention_ttl_days')}",
        f"- status: {session.get('status')}",
        "",
        "## Governance Checks",
        f"- audit_chain_valid: {governance['audit_verify'].get('valid')}",
        f"- audit_entries_checked: {governance['audit_verify'].get('checked_entries')}",
        f"- purge_dry_run_sessions: {governance['purge_preview'].get('purged_sessions')}",
        f"- context_trace_count: {len(governance['context_traces'].get('items', []))}",
        "",
        "## Scoring Provenance",
        f"- scorer_version: {scoring_lock.get('scorer_version')}",
        f"- rubric_version: {scoring_lock.get('rubric_version')}",
        f"- task_family_version: {scoring_lock.get('task_family_version')}",
        f"- model_hash: {scoring_lock.get('model_hash')}",
        "",
        "## Report Signals",
        f"- confidence: {report_summary.get('confidence')}",
        f"- needs_human_review: {report_summary.get('needs_human_review')}",
        f"- trigger_codes: {', '.join(report_summary.get('trigger_codes', []))}",
        f"- trigger_count: {report_summary.get('trigger_count')}",
        "",
        "## Context Injection",
        f"- traces: {len(governance['context_traces'].get('items', []))}",
        "",
        "## Safety References",
        f"- fairness_run_id: {(governance.get('fairness_run') or {}).get('id')}",
        f"- redteam_run_id: {(governance.get('redteam_run') or {}).get('id')}",
        "",
        "## Notes",
        "- This bundle is evidence-only and non-mutating.",
        "- Use accompanying governance_bundle.json for full raw payloads.",
    ]
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Build a governance proof bundle (Markdown + JSON + manifest).")
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--bootstrap-token", default="moonshot-bootstrap-dev")
    parser.add_argument("--tenant-id", default="tenant_demo")
    parser.add_argument("--session-id", required=True)
    parser.add_argument("--admin-user-id", default="bundle_admin")
    parser.add_argument("--reviewer-user-id", default="bundle_reviewer")
    parser.add_argument("--fairness-run-id", default=None)
    parser.add_argument("--redteam-run-id", default=None)
    parser.add_argument("--output-dir", default=None)
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    generated_at = _now_iso()
    output_dir = (
        Path(args.output_dir).resolve()
        if args.output_dir
        else Path("/tmp/moonshot_demo_bundle").resolve() / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    )
    output_dir.mkdir(parents=True, exist_ok=True)

    _require_ok(requests.get(f"{base_url}/health", timeout=10), step="health", expected_status=200)
    meta = _require_ok(requests.get(f"{base_url}/v1/meta/version", timeout=10), step="meta_version", expected_status=200)

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

    session = _authed_get(base_url, reviewer_token, f"/v1/sessions/{args.session_id}", step="get_session")
    report_summary = _authed_get(base_url, reviewer_token, f"/v1/reports/{args.session_id}/summary", step="get_report_summary")
    report = _authed_get(base_url, reviewer_token, f"/v1/reports/{args.session_id}", step="get_report")
    context_traces = _authed_get(
        base_url,
        reviewer_token,
        f"/v1/context/injection-traces/{args.session_id}",
        step="get_context_traces",
    )

    purge_preview = _authed_post(
        base_url,
        admin_token,
        "/v1/admin/policies/purge-expired",
        {"dry_run": True},
        step="purge_expired_dry_run",
    )
    audit_verify = _authed_get(base_url, admin_token, "/v1/audit-logs/verify", step="verify_audit_logs")
    redteam_run = _resolve_redteam_reference(
        base_url=base_url,
        admin_token=admin_token,
        session_id=args.session_id,
        redteam_run_id=args.redteam_run_id,
    )
    fairness_run = _resolve_fairness_reference(
        base_url=base_url,
        admin_token=admin_token,
        fairness_run_id=args.fairness_run_id,
    )

    json_payload = {
        "generated_at": generated_at,
        "base_url": base_url,
        "tenant_id": args.tenant_id,
        "session_id": args.session_id,
        "meta": meta,
        "session": session,
        "report_summary": report_summary,
        "report": report,
        "governance": {
            "purge_preview": purge_preview,
            "audit_verify": audit_verify,
            "context_traces": context_traces,
            "redteam_run": redteam_run,
            "fairness_run": fairness_run,
        },
    }

    markdown = _build_markdown(json_payload)
    md_path = output_dir / "governance_bundle.md"
    json_path = output_dir / "governance_bundle.json"
    manifest_path = output_dir / "manifest.json"

    md_path.write_text(markdown, encoding="utf-8")
    json_path.write_text(json.dumps(json_payload, indent=2), encoding="utf-8")

    manifest_payload = {
        "generated_at": generated_at,
        "bundle_dir": str(output_dir),
        "files": {
            "governance_bundle.md": {"path": str(md_path), "sha256": _sha256(md_path)},
            "governance_bundle.json": {"path": str(json_path), "sha256": _sha256(json_path)},
        },
        "meta_version": meta,
        "checks": [
            "session_policy",
            "ttl_purge_dry_run",
            "audit_chain_verification",
            "report_provenance",
            "context_injection_traces",
            "fairness_redteam_references",
        ],
    }
    manifest_path.write_text(json.dumps(manifest_payload, indent=2), encoding="utf-8")

    print(
        json.dumps(
            {
                "bundle_dir": str(output_dir),
                "governance_bundle_md": str(md_path),
                "governance_bundle_json": str(json_path),
                "manifest": str(manifest_path),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"governance-bundle: FAIL ({exc})", file=sys.stderr)
        raise SystemExit(1)
