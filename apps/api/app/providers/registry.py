from __future__ import annotations

from app.core.config import get_settings
from typing import cast

from app.providers.contracts import CoDesignProvider, CoachProvider, EvaluatorProvider
from app.providers.gemini import GeminiProvider
from app.providers.openai import OpenAIProvider


def _provider_instance() -> CoDesignProvider | CoachProvider | EvaluatorProvider:
    settings = get_settings()
    if settings.model_provider == "openai":
        return OpenAIProvider()
    if settings.model_provider == "gemini":
        return GeminiProvider()
    raise RuntimeError("unsupported_model_provider")


def get_codesign_provider() -> CoDesignProvider:
    return cast(CoDesignProvider, _provider_instance())


def get_coach_provider() -> CoachProvider:
    return cast(CoachProvider, _provider_instance())


def get_evaluator_provider() -> EvaluatorProvider:
    return cast(EvaluatorProvider, _provider_instance())
