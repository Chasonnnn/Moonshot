from __future__ import annotations

import sys
from pathlib import Path

import yaml


REPO_ROOT = Path(__file__).resolve().parents[3]
OPENAPI_PATH = REPO_ROOT / "docs" / "03_api" / "openapi.yaml"
CHANGELOG_PATH = REPO_ROOT / "docs" / "03_api" / "changelog.md"


def main() -> int:
    openapi_payload = yaml.safe_load(OPENAPI_PATH.read_text(encoding="utf-8"))
    version = str(openapi_payload.get("info", {}).get("version", "")).strip()
    if not version:
        print("contract-governance: missing OpenAPI info.version")
        return 1

    changelog = CHANGELOG_PATH.read_text(encoding="utf-8")
    marker = f"## {version} - "
    if marker not in changelog:
        print(f"contract-governance: changelog entry missing for OpenAPI version {version}")
        return 1

    print(f"contract-governance: OK (version={version})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
