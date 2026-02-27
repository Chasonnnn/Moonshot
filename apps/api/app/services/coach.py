from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

import yaml

from app.schemas import CoachResponse

POLICY_PATH = Path("/Users/chason/Moonshot/apps/api/app/policies/coach_policy.yaml")


@lru_cache(maxsize=1)
def _load_policy() -> dict:
    raw = yaml.safe_load(POLICY_PATH.read_text(encoding="utf-8"))
    blocked = raw.get("blocked_patterns") or []
    normalized: list[dict[str, str]] = []
    for idx, pattern in enumerate(blocked, start=1):
        if isinstance(pattern, dict):
            rule_id = str(pattern.get("id") or f"rule_{idx}")
            regex = str(pattern.get("regex") or pattern.get("phrase") or "")
        else:
            rule_id = f"rule_{idx}"
            regex = re.escape(str(pattern))
        normalized.append({"id": rule_id, "regex": regex})

    return {
        "version": str(raw.get("version", "0.1.0")),
        "mode": str(raw.get("mode", "context_only")),
        "blocked_rules": normalized,
    }


def coach_reply(message: str, session_context: str) -> CoachResponse:
    policy = _load_policy()
    lowered = message.lower()

    for rule in policy["blocked_rules"]:
        if re.search(rule["regex"], lowered):
            return CoachResponse(
                allowed=False,
                response=(
                    "I can clarify business context and constraints, but I cannot provide direct answers or solve the task. "
                    "Please describe your current approach and I can help validate constraints."
                ),
                policy_reason="direct_answer_disallowed",
                policy_version=policy["version"],
                blocked_rule_id=rule["id"],
            )

    return CoachResponse(
        allowed=True,
        response=(
            "Context reminder: "
            f"{session_context[:280]}"
            " | Focus on assumptions, evidence quality, and policy constraints before submission."
        ),
        policy_reason="context_only_allowed",
        policy_version=policy["version"],
        blocked_rule_id=None,
    )
