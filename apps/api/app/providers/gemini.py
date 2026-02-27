from __future__ import annotations

import hashlib
import time

from app.core.config import get_settings
from app.providers.contracts import CoDesignProvider, CoachProvider, EvaluatorProvider, ProviderOutput


class GeminiProvider(CoDesignProvider, CoachProvider, EvaluatorProvider):
    def __init__(self) -> None:
        settings = get_settings()
        self.model = settings.gemini_model

    def _output(self, prompt: str, content: str) -> ProviderOutput:
        started = time.perf_counter_ns()
        prompt_hash = hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:16]
        latency_ms = max(1, int((time.perf_counter_ns() - started) / 1_000_000))
        return ProviderOutput(
            content=content,
            model=self.model,
            provider="gemini",
            prompt_hash=prompt_hash,
            latency_ms=latency_ms,
        )

    def generate_variant(self, prompt: str) -> ProviderOutput:
        return self._output(prompt, content=prompt)

    def generate_rubric(self, prompt: str) -> ProviderOutput:
        return self._output(prompt, content=prompt)

    def contextual_hint(self, prompt: str) -> ProviderOutput:
        return self._output(prompt, content=prompt)

    def score_dimension(self, prompt: str) -> ProviderOutput:
        return self._output(prompt, content=prompt)
