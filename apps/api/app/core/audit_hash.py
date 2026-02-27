from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any


def canonicalize_metadata(metadata: dict[str, Any]) -> str:
    return json.dumps(metadata, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def normalize_timestamp(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def compute_audit_entry_hash(
    *,
    prev_hash: str,
    entry_id: str,
    tenant_id: str,
    actor_role: str,
    action: str,
    resource_type: str,
    resource_id: str,
    metadata: dict[str, Any],
    created_at: datetime,
) -> str:
    payload = (
        f"{prev_hash}|{entry_id}|{tenant_id}|{actor_role}|{action}|"
        f"{resource_type}|{resource_id}|{canonicalize_metadata(metadata)}|{normalize_timestamp(created_at)}"
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
