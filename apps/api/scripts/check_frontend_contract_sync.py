from __future__ import annotations

import sys
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[3]
OPENAPI_PATH = REPO_ROOT / "docs/03_api/openapi.yaml"
FRONTEND_CONTRACT_PATH = REPO_ROOT / "docs/08_frontend_contract/frontend_backend_contract.md"
MVP_SCOPE_PATH = REPO_ROOT / "docs/00_mvp/mvp_scope.md"

REQUIRED_FRONTEND_MARKERS = [
    "Idempotency-Key",
    "job_not_ready",
    "/v1/reports/{session_id}/summary",
]


def _read(path: Path) -> str:
    if not path.exists():
        raise RuntimeError(f"frontend-contract-sync: missing file at {path}")
    return path.read_text(encoding="utf-8")


def _openapi_version() -> str:
    payload = yaml.safe_load(_read(OPENAPI_PATH))
    version = str(payload.get("info", {}).get("version", "")).strip()
    if not version:
        raise RuntimeError("frontend-contract-sync: OpenAPI info.version is missing")
    return version


def main() -> int:
    version = _openapi_version()
    expected_tag = f"v{version}"

    frontend_contract = _read(FRONTEND_CONTRACT_PATH)
    mvp_scope = _read(MVP_SCOPE_PATH)

    if expected_tag not in frontend_contract:
        raise RuntimeError(
            "frontend-contract-sync: frontend contract version mismatch "
            f"(expected marker `{expected_tag}`)"
        )
    if expected_tag not in mvp_scope:
        raise RuntimeError(
            "frontend-contract-sync: MVP scope version mismatch "
            f"(expected marker `{expected_tag}`)"
        )

    for marker in REQUIRED_FRONTEND_MARKERS:
        if marker not in frontend_contract:
            raise RuntimeError(f"frontend-contract-sync: missing frontend marker `{marker}`")

    print(f"frontend-contract-sync: OK (version={version})")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"frontend-contract-sync: FAIL ({exc})", file=sys.stderr)
        raise SystemExit(1)
