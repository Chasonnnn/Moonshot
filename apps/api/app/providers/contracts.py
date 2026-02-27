from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class ProviderOutput:
    content: str
    model: str
    provider: str
    prompt_hash: str
    latency_ms: int


class CoDesignProvider(Protocol):
    def generate_variant(self, prompt: str) -> ProviderOutput: ...

    def generate_rubric(self, prompt: str) -> ProviderOutput: ...


class CoachProvider(Protocol):
    def contextual_hint(self, prompt: str) -> ProviderOutput: ...


class EvaluatorProvider(Protocol):
    def score_dimension(self, prompt: str) -> ProviderOutput: ...
