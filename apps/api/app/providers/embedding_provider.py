from __future__ import annotations

import hashlib
import math
import re
from typing import Protocol

from app.core.config import get_settings

_TOKEN_PATTERN = re.compile(r"[a-z0-9_]+")


class EmbeddingProvider(Protocol):
    def embed(self, text: str) -> list[float]: ...


def _normalize(text: str) -> list[str]:
    return _TOKEN_PATTERN.findall(text.lower())


class HashEmbeddingProvider:
    def __init__(self, dimensions: int | None = None) -> None:
        settings = get_settings()
        resolved_dimensions = int(dimensions or settings.embedding_dimensions)
        if resolved_dimensions <= 0:
            raise RuntimeError("embedding_dimensions_invalid")
        self._dimensions = resolved_dimensions

    def embed(self, text: str) -> list[float]:
        tokens = _normalize(text)
        if not tokens:
            return [0.0] * self._dimensions

        vector = [0.0] * self._dimensions
        for token in tokens:
            digest = hashlib.sha256(token.encode("utf-8")).digest()
            index = int.from_bytes(digest[:4], "big") % self._dimensions
            sign = 1.0 if digest[4] % 2 == 0 else -1.0
            vector[index] += sign

        norm = math.sqrt(sum(value * value for value in vector))
        if norm == 0.0:
            return [0.0] * self._dimensions
        return [round(value / norm, 6) for value in vector]


def get_embedding_provider() -> EmbeddingProvider:
    settings = get_settings()
    provider_name = str(settings.embedding_provider).strip().lower()
    if provider_name == "hash":
        return HashEmbeddingProvider(dimensions=settings.embedding_dimensions)
    raise RuntimeError("embedding_provider_unavailable")
