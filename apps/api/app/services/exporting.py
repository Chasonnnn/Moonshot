from __future__ import annotations

import json
from uuid import UUID

from app.schemas import ExportBundle, Report

EXPORT_SCHEMA_VERSION = "1.0.0"
EXPORT_CSV_HEADERS = [
    "session_id",
    "confidence",
    "needs_human_review",
    "query_error_rate",
    "ai_prompt_count",
    "policy_violation_count",
]


def build_export(run_id: UUID, report: Report) -> ExportBundle:
    score = report.score_result
    csv_headers = list(EXPORT_CSV_HEADERS)
    csv_values = [
        str(report.session_id),
        str(score.confidence),
        str(score.needs_human_review),
        str(score.objective_metrics.get("query_error_rate", "")),
        str(score.objective_metrics.get("ai_prompt_count", "")),
        str(score.objective_metrics.get("policy_violation_count", "")),
    ]
    csv = ",".join(csv_headers) + "\n" + ",".join(csv_values)

    tableau_schema = {
        "table": "moonshot_scores",
        "fields": [
            {"name": "session_id", "type": "string"},
            {"name": "confidence", "type": "float"},
            {"name": "needs_human_review", "type": "bool"},
            {"name": "query_error_rate", "type": "float"},
            {"name": "ai_prompt_count", "type": "int"},
            {"name": "policy_violation_count", "type": "int"},
        ],
    }

    return ExportBundle(
        run_id=run_id,
        schema_version=EXPORT_SCHEMA_VERSION,
        csv_headers=csv_headers,
        csv=csv,
        json_payload=json.loads(report.model_dump_json()),
        tableau_schema=tableau_schema,
    )
