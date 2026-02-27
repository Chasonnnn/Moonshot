from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from app.core.audit_hash import compute_audit_entry_hash


@dataclass(frozen=True)
class AuditVerificationResult:
    valid: bool
    checked_entries: int
    error_code: str | None = None
    error_detail: str | None = None
    failed_index: int | None = None


def verify_audit_chain(entries: list[dict[str, Any]]) -> AuditVerificationResult:
    if not entries:
        return AuditVerificationResult(valid=True, checked_entries=0)

    expected_prev_hash = "GENESIS"
    for idx, row in enumerate(entries):
        row_prev_hash = str(row.get("prev_hash") or "")
        row_entry_hash = str(row.get("entry_hash") or "")

        created_at_raw = row.get("created_at")
        if isinstance(created_at_raw, str):
            created_at = datetime.fromisoformat(created_at_raw)
        elif isinstance(created_at_raw, datetime):
            created_at = created_at_raw
        else:
            return AuditVerificationResult(
                valid=False,
                checked_entries=idx + 1,
                error_code="audit_chain_invalid",
                error_detail="missing_created_at",
                failed_index=idx,
            )

        recomputed = compute_audit_entry_hash(
            prev_hash=expected_prev_hash,
            entry_id=str(row.get("id")),
            tenant_id=str(row.get("tenant_id")),
            actor_role=str(row.get("actor_role")),
            action=str(row.get("action")),
            resource_type=str(row.get("resource_type")),
            resource_id=str(row.get("resource_id")),
            metadata=row.get("metadata", {}) or {},
            created_at=created_at,
        )

        if row_prev_hash != expected_prev_hash:
            return AuditVerificationResult(
                valid=False,
                checked_entries=idx + 1,
                error_code="audit_chain_invalid",
                error_detail="prev_hash_mismatch",
                failed_index=idx,
            )
        if row_entry_hash != recomputed:
            return AuditVerificationResult(
                valid=False,
                checked_entries=idx + 1,
                error_code="audit_chain_invalid",
                error_detail="entry_hash_mismatch",
                failed_index=idx,
            )
        expected_prev_hash = row_entry_hash

    return AuditVerificationResult(valid=True, checked_entries=len(entries))
