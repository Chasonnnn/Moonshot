from __future__ import annotations

import argparse
import statistics
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass

import requests


@dataclass(frozen=True)
class EndpointSpec:
    name: str
    method: str
    path: str
    expected_status: int
    role: str | None = None


def _percentile(values: list[float], p: float) -> float:
    if not values:
        raise RuntimeError("load-pilot: cannot compute percentile of empty series")
    ordered = sorted(values)
    rank = max(0, min(len(ordered) - 1, int((p / 100.0) * len(ordered)) - 1))
    return ordered[rank]


def _issue_token(base_url: str, bootstrap_token: str, tenant_id: str, role: str, user_id: str) -> str:
    response = requests.post(
        f"{base_url}/v1/auth/token",
        headers={"X-Bootstrap-Token": bootstrap_token},
        json={"role": role, "user_id": user_id, "tenant_id": tenant_id, "expires_in_seconds": 3600},
        timeout=10,
    )
    if response.status_code != 201:
        raise RuntimeError(f"load-pilot: issue_token failed role={role} status={response.status_code} body={response.text[:500]}")
    payload = response.json()
    return str(payload["access_token"])


def _run_request(base_url: str, endpoint: EndpointSpec, tokens: dict[str, str], timeout: float) -> tuple[str, int, float]:
    headers: dict[str, str] = {}
    if endpoint.role is not None:
        headers["Authorization"] = f"Bearer {tokens[endpoint.role]}"

    started = time.perf_counter()
    response = requests.request(
        endpoint.method,
        f"{base_url}{endpoint.path}",
        headers=headers,
        timeout=timeout,
    )
    latency_ms = (time.perf_counter() - started) * 1000.0
    return endpoint.name, response.status_code, latency_ms


def _build_endpoints() -> list[EndpointSpec]:
    return [
        EndpointSpec(name="health", method="GET", path="/health", expected_status=200),
        EndpointSpec(name="meta_version", method="GET", path="/v1/meta/version", expected_status=200),
        EndpointSpec(name="cases_list", method="GET", path="/v1/cases", expected_status=200, role="reviewer"),
        EndpointSpec(name="task_families_list", method="GET", path="/v1/task-families", expected_status=200, role="reviewer"),
        EndpointSpec(name="sessions_list", method="GET", path="/v1/sessions", expected_status=200, role="reviewer"),
        EndpointSpec(name="jobs_list", method="GET", path="/v1/jobs", expected_status=200, role="org_admin"),
        EndpointSpec(name="audit_logs", method="GET", path="/v1/audit-logs", expected_status=200, role="org_admin"),
        EndpointSpec(name="slo_probes", method="GET", path="/v1/slo/probes", expected_status=200, role="org_admin"),
    ]


def main() -> int:
    parser = argparse.ArgumentParser(description="Run pilot-envelope load checks and enforce p95 latency SLO gates.")
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--bootstrap-token", default="moonshot-bootstrap-dev")
    parser.add_argument("--tenant-id", default="tenant_load")
    parser.add_argument("--samples", type=int, default=240)
    parser.add_argument("--concurrency", type=int, default=8)
    parser.add_argument("--max-p95-ms", type=float, default=500.0)
    parser.add_argument("--request-timeout", type=float, default=10.0)
    args = parser.parse_args()

    if args.samples <= 0:
        raise RuntimeError("load-pilot: --samples must be > 0")
    if args.concurrency <= 0:
        raise RuntimeError("load-pilot: --concurrency must be > 0")

    base_url = args.base_url.rstrip("/")
    endpoints = _build_endpoints()

    tokens = {
        "org_admin": _issue_token(base_url, args.bootstrap_token, args.tenant_id, "org_admin", "load_admin"),
        "reviewer": _issue_token(base_url, args.bootstrap_token, args.tenant_id, "reviewer", "load_reviewer"),
    }

    request_plan: list[EndpointSpec] = [endpoints[i % len(endpoints)] for i in range(args.samples)]
    latencies: dict[str, list[float]] = {endpoint.name: [] for endpoint in endpoints}
    failures: list[str] = []

    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        futures = [pool.submit(_run_request, base_url, endpoint, tokens, args.request_timeout) for endpoint in request_plan]
        for future in as_completed(futures):
            name, status_code, latency_ms = future.result()
            latencies[name].append(latency_ms)

            expected = next(endpoint.expected_status for endpoint in endpoints if endpoint.name == name)
            if status_code != expected:
                failures.append(f"{name}: status={status_code} expected={expected}")

    if failures:
        unique_failures = sorted(set(failures))
        raise RuntimeError(f"load-pilot: endpoint failures detected: {unique_failures[:10]}")

    p95_by_endpoint: dict[str, float] = {}
    for endpoint in endpoints:
        series = latencies[endpoint.name]
        if not series:
            raise RuntimeError(f"load-pilot: no samples collected for {endpoint.name}")
        p95_by_endpoint[endpoint.name] = round(_percentile(series, 95), 2)

    all_samples = [value for values in latencies.values() for value in values]
    aggregate = {
        "count": len(all_samples),
        "mean_ms": round(statistics.fmean(all_samples), 2),
        "p95_ms": round(_percentile(all_samples, 95), 2),
    }

    print("load-pilot: summary")
    print(f"load-pilot: aggregate count={aggregate['count']} mean_ms={aggregate['mean_ms']} p95_ms={aggregate['p95_ms']}")
    for endpoint_name in sorted(p95_by_endpoint):
        print(f"load-pilot: endpoint={endpoint_name} p95_ms={p95_by_endpoint[endpoint_name]}")

    breaching = {name: value for name, value in p95_by_endpoint.items() if value > args.max_p95_ms}
    if breaching:
        raise RuntimeError(f"load-pilot: p95 gate failed threshold={args.max_p95_ms} breaches={breaching}")

    print(f"load-pilot: PASS (p95 <= {args.max_p95_ms}ms for all monitored endpoints)")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"load-pilot: FAIL ({exc})", file=sys.stderr)
        raise SystemExit(1)
