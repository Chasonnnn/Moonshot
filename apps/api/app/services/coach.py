from __future__ import annotations

import re

from app.schemas import CoachResponse

# Context-only coaching: deny direct-answer or query-writing requests.
BLOCKED_PATTERNS = [
    r"\bexact answer\b",
    r"\bgive me the answer\b",
    r"\bwrite the sql\b",
    r"\bsolve this for me\b",
    r"\bwhat should i submit\b",
]


def coach_reply(message: str, session_context: str) -> CoachResponse:
    lowered = message.lower()
    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, lowered):
            return CoachResponse(
                allowed=False,
                response=(
                    "I can clarify business context and constraints, but I cannot provide direct answers or solve the task. "
                    "Please describe your current approach and I can help validate constraints."
                ),
                policy_reason="direct_answer_disallowed",
            )

    return CoachResponse(
        allowed=True,
        response=(
            "Context reminder: "
            f"{session_context[:280]}"
            " | Focus on assumptions, evidence quality, and policy constraints before submission."
        ),
        policy_reason="context_only_allowed",
    )
