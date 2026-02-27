from __future__ import annotations

import sys
from pathlib import Path

import yaml
from fastapi.testclient import TestClient

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.main import app


REPO_ROOT = Path(__file__).resolve().parents[3]
DOCS_OPENAPI_PATH = REPO_ROOT / "docs" / "03_api" / "openapi.yaml"


def _load_docs_openapi() -> dict:
    if not DOCS_OPENAPI_PATH.exists():
        raise RuntimeError(f"openapi-sync: missing docs file at {DOCS_OPENAPI_PATH}")
    payload = yaml.safe_load(DOCS_OPENAPI_PATH.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise RuntimeError("openapi-sync: docs/03_api/openapi.yaml did not parse as an object")
    return payload


def _load_runtime_openapi() -> dict:
    with TestClient(app) as client:
        response = client.get("/openapi.json")
    if response.status_code != 200:
        raise RuntimeError(f"openapi-sync: /openapi.json returned status={response.status_code}")
    payload = response.json()
    if not isinstance(payload, dict):
        raise RuntimeError("openapi-sync: runtime openapi.json did not parse as an object")
    return payload


def main() -> int:
    docs_payload = _load_docs_openapi()
    runtime_payload = _load_runtime_openapi()

    if docs_payload == runtime_payload:
        print("openapi-sync: OK")
        return 0

    docs_paths = set((docs_payload.get("paths") or {}).keys())
    runtime_paths = set((runtime_payload.get("paths") or {}).keys())
    missing_in_docs = sorted(runtime_paths - docs_paths)
    stale_in_docs = sorted(docs_paths - runtime_paths)

    print("openapi-sync: docs/03_api/openapi.yaml is out of sync with runtime /openapi.json")
    if missing_in_docs:
        print(f"openapi-sync: missing in docs ({len(missing_in_docs)}): {missing_in_docs[:20]}")
    if stale_in_docs:
        print(f"openapi-sync: stale in docs ({len(stale_in_docs)}): {stale_in_docs[:20]}")
    print("openapi-sync: run `uv run python apps/api/scripts/dump_openapi.py` and commit the updated spec")
    return 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"openapi-sync: FAIL ({exc})", file=sys.stderr)
        raise SystemExit(1)
