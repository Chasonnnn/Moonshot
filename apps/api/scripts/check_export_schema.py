from __future__ import annotations

import json
import sys
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[3]
API_ROOT = REPO_ROOT / "apps" / "api"
OPENAPI_PATH = REPO_ROOT / "docs" / "03_api" / "openapi.yaml"
EXAMPLES_PATH = API_ROOT / "fixtures" / "api_examples.json"

if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.services.exporting import EXPORT_CSV_HEADERS, EXPORT_SCHEMA_VERSION


def _load_openapi() -> dict:
    if not OPENAPI_PATH.exists():
        raise RuntimeError(f"export-schema: missing OpenAPI spec at {OPENAPI_PATH}")
    payload = yaml.safe_load(OPENAPI_PATH.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise RuntimeError("export-schema: OpenAPI payload must be an object")
    return payload


def _load_examples() -> dict:
    if not EXAMPLES_PATH.exists():
        raise RuntimeError(f"export-schema: missing API examples at {EXAMPLES_PATH}")
    payload = json.loads(EXAMPLES_PATH.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise RuntimeError("export-schema: API examples payload must be an object")
    return payload


def _expect_object(mapping: dict, key: str) -> dict:
    value = mapping.get(key)
    if not isinstance(value, dict):
        raise RuntimeError(f"export-schema: missing object `{key}`")
    return value


def _check_openapi(payload: dict) -> None:
    paths = _expect_object(payload, "paths")
    _expect_object(paths, "/v1/exports")
    export_run = _expect_object(paths, "/v1/exports/{run_id}")
    get_op = _expect_object(export_run, "get")
    responses = _expect_object(get_op, "responses")
    success = _expect_object(responses, "200")
    content = _expect_object(success, "content")
    app_json = _expect_object(content, "application/json")
    schema = _expect_object(app_json, "schema")
    if schema.get("$ref") != "#/components/schemas/ExportBundle":
        raise RuntimeError("export-schema: /v1/exports/{run_id} must reference ExportBundle")

    components = _expect_object(payload, "components")
    schemas = _expect_object(components, "schemas")
    export_bundle = _expect_object(schemas, "ExportBundle")
    properties = _expect_object(export_bundle, "properties")

    if "schema_version" not in properties:
        raise RuntimeError("export-schema: ExportBundle missing `schema_version`")
    if "csv_headers" not in properties:
        raise RuntimeError("export-schema: ExportBundle missing `csv_headers`")


def _check_examples(payload: dict) -> None:
    job_result = _expect_object(payload, "job_result_export_completed")
    response = _expect_object(job_result, "response")
    result = _expect_object(response, "result")

    schema_version = result.get("schema_version")
    if schema_version != EXPORT_SCHEMA_VERSION:
        raise RuntimeError(
            "export-schema: schema_version mismatch "
            f"(examples={schema_version}, backend={EXPORT_SCHEMA_VERSION})"
        )

    headers = result.get("csv_headers")
    if headers != EXPORT_CSV_HEADERS:
        raise RuntimeError("export-schema: csv_headers mismatch between examples and backend")


def main() -> int:
    _check_openapi(_load_openapi())
    _check_examples(_load_examples())
    print("export-schema: OK")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"export-schema: FAIL ({exc})", file=sys.stderr)
        raise SystemExit(1)
