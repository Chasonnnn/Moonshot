from __future__ import annotations

from app.core.config import get_settings
from typing import Literal, cast

from app.providers.contracts import CoDesignProvider, CoachProvider, EvaluatorProvider
from app.providers.litellm_provider import LiteLLMProvider


def _provider_instance(
    *,
    agent_type: Literal["codesign", "coach", "evaluator"],
    model_override: str | None = None,
    reasoning_effort: str | None = None,
    thinking_budget_tokens: int | None = None,
) -> CoDesignProvider | CoachProvider | EvaluatorProvider:
    settings = get_settings()
    if settings.model_provider == "litellm":
        return LiteLLMProvider(
            agent_type=agent_type,
            model_override=model_override,
            reasoning_effort=reasoning_effort,
            thinking_budget_tokens=thinking_budget_tokens,
        )
    raise RuntimeError("unsupported_model_provider")


def get_codesign_provider(
    *,
    model_override: str | None = None,
    reasoning_effort: str | None = None,
    thinking_budget_tokens: int | None = None,
) -> CoDesignProvider:
    return cast(
        CoDesignProvider,
        _provider_instance(
            agent_type="codesign",
            model_override=model_override,
            reasoning_effort=reasoning_effort,
            thinking_budget_tokens=thinking_budget_tokens,
        ),
    )


def get_coach_provider(
    *,
    model_override: str | None = None,
    reasoning_effort: str | None = None,
    thinking_budget_tokens: int | None = None,
) -> CoachProvider:
    return cast(
        CoachProvider,
        _provider_instance(
            agent_type="coach",
            model_override=model_override,
            reasoning_effort=reasoning_effort,
            thinking_budget_tokens=thinking_budget_tokens,
        ),
    )


def get_evaluator_provider(
    *,
    model_override: str | None = None,
    reasoning_effort: str | None = None,
    thinking_budget_tokens: int | None = None,
) -> EvaluatorProvider:
    return cast(
        EvaluatorProvider,
        _provider_instance(
            agent_type="evaluator",
            model_override=model_override,
            reasoning_effort=reasoning_effort,
            thinking_budget_tokens=thinking_budget_tokens,
        ),
    )
