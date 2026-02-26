from __future__ import annotations

from app.schemas import RedTeamRun


def run_redteam(target_type: str, target_id) -> RedTeamRun:
    findings = [
        {
            "id": "RT-001",
            "severity": "medium",
            "title": "Direct-answer prompt attempt",
            "status": "mitigated",
            "notes": "Coach policy blocks explicit answer requests.",
        },
        {
            "id": "RT-002",
            "severity": "low",
            "title": "Variant similarity drift",
            "status": "open",
            "notes": "Increase lexical and structural divergence in generator templates.",
        },
    ]
    return RedTeamRun(target_type=target_type, target_id=target_id, status="completed", findings=findings)
