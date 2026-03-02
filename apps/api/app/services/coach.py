from __future__ import annotations

import hashlib
import re
from functools import lru_cache
from pathlib import Path

import yaml

from app.providers import get_coach_provider
from app.schemas import CoachResponse

POLICY_PATH = Path(__file__).resolve().parents[1] / "policies" / "coach_policy.yaml"


@lru_cache(maxsize=1)
def _load_policy() -> dict:
    raw_text = POLICY_PATH.read_text(encoding="utf-8")
    raw = yaml.safe_load(raw_text)
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
        "hash": hashlib.sha256(raw_text.encode("utf-8")).hexdigest(),
        "mode": str(raw.get("mode", "context_only")),
        "blocked_rules": normalized,
    }


def coach_reply(message: str, session_context: str, *, mode: str = "assessment") -> CoachResponse:
    policy = _load_policy()
    lowered = message.lower()

    if mode == "assessment":
        for rule in policy["blocked_rules"]:
            if re.search(rule["regex"], lowered):
                return CoachResponse(
                    allowed=False,
                    response=(
                        "I can clarify business context and constraints, but I cannot provide direct answers or solve the task. "
                        "Please describe your current approach and I can help validate constraints."
                    ),
                    policy_reason="direct_answer_disallowed",
                    policy_decision_code="blocked_direct_answer",
                    policy_version=policy["version"],
                    policy_hash=policy["hash"],
                    blocked_rule_id=rule["id"],
                )

    provider = get_coach_provider()
    if mode == "practice":
        prompt = (
            "You are a coaching assistant in practice mode. "
            "Provide structured guidance and learning scaffolds without giving final submission text.\n\n"
            f"Session context:\n{session_context[:1200]}\n\n"
            f"Learner message:\n{message}\n\n"
            "Return: (1) what is correct, (2) what is risky, (3) what is missing, (4) next-step checklist."
        )
    else:
        prompt = (
            "You are a constrained interview coach in assessment mode. "
            "Do not provide direct answers. Give only contextual guidance.\n\n"
            f"Session context:\n{session_context[:1200]}\n\n"
            f"Candidate message:\n{message}\n\n"
            "Return a short coaching hint focused on constraints, assumptions, and verification steps."
        )
    output = provider.contextual_hint(prompt)

    return CoachResponse(
        allowed=True,
        response=output.content,
        policy_reason="practice_guidance_allowed" if mode == "practice" else "context_only_allowed",
        policy_decision_code="allowed_practice_guidance" if mode == "practice" else "allowed_context_only",
        policy_version=policy["version"],
        policy_hash=policy["hash"],
        blocked_rule_id=None,
    )
