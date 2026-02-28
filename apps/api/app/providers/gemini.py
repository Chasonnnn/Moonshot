from __future__ import annotations

import hashlib
import time
from typing import Any

from app.core.config import get_settings
from app.providers.contracts import CoDesignProvider, CoachProvider, EvaluatorProvider, ProviderOutput


class GeminiProvider(CoDesignProvider, CoachProvider, EvaluatorProvider):
    def __init__(self, client: Any | None = None) -> None:
        settings = get_settings()
        self.model = settings.gemini_model
        api_key = settings.gemini_api_key
        if api_key is None or not api_key.strip():
            raise RuntimeError("gemini_api_key_missing")

        if client is not None:
            self._client = client
            return

        try:
            from google import genai  # type: ignore
        except ImportError as exc:
            raise RuntimeError("gemini_sdk_missing") from exc

        self._client = genai.Client(api_key=api_key)

    def _invoke(self, prompt: str) -> ProviderOutput:
        started = time.perf_counter_ns()
        prompt_hash = hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:16]

        response = self._client.models.generate_content(
            model=self.model,
            contents=prompt,
        )

        content = getattr(response, "text", None)
        if not isinstance(content, str) or not content.strip():
            raise RuntimeError("gemini_empty_response")

        latency_ms = max(1, int((time.perf_counter_ns() - started) / 1_000_000))
        return ProviderOutput(
            content=content.strip(),
            model=self.model,
            provider="gemini",
            prompt_hash=prompt_hash,
            latency_ms=latency_ms,
        )

    def generate_variant(self, prompt: str) -> ProviderOutput:
        return self._invoke(prompt)

    def generate_rubric(self, prompt: str) -> ProviderOutput:
        return self._invoke(prompt)

    def contextual_hint(self, prompt: str) -> ProviderOutput:
        return self._invoke(prompt)

    def score_dimension(self, prompt: str) -> ProviderOutput:
        return self._invoke(prompt)

    def score_holistic(self, prompt: str) -> ProviderOutput:
        return self._invoke(prompt)
