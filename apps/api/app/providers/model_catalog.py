from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Callable, Protocol
from urllib import error as urllib_error
from urllib import request as urllib_request

from app.core.config import get_settings
from app.schemas import ModelOptionStatus, ModelOptionsResponse

REQUIRED_MODEL_IDS: tuple[str, ...] = (
    "gpt-5.3-codex",
    "chatgpt/gpt-5.2",
    "gemini/gemini-3.1-pro-preview",
    "gemini/gemini-3.1-flash-lite-preview",
    "anthropic/claude-opus-4-6",
)

DEFAULT_MODEL_BY_AGENT: dict[str, str] = {
    "codesign": "gpt-5.3-codex",
    "coach": "chatgpt/gpt-5.2",
    "evaluator": "anthropic/claude-opus-4-6",
}

XHIGH_ALLOWED_MODELS: frozenset[str] = frozenset(
    {
        "gpt-5.3-codex",
        "gpt-5.2",
        "chatgpt/gpt-5.2",
        "gpt-5.2-pro",
    }
)

MODEL_ID_ALIASES: dict[str, tuple[str, ...]] = {
    "gpt-5.3-codex": (
        "gpt-5.3-codex",
        "openai.gpt-5.3-codex",
        "openai/gpt-5.3-codex",
        "azure/gpt-5.3-codex",
        "azure_ai/gpt-5.3-codex",
    ),
    "chatgpt/gpt-5.2": (
        "chatgpt/gpt-5.2",
        "openai.gpt-5.2",
        "openai.gpt-5.2-chat",
        "openai.gpt-5.2.2025-12-11",
        "openai.gpt-5.2-chat.2025-12-11",
        "azure/gpt-5.2",
        "azure/gpt-5.2-chat",
        "openai/gpt-5.2",
        "openai/gpt-5.2-chat",
    ),
    "gemini/gemini-3.1-pro-preview": (
        "gemini/gemini-3.1-pro-preview",
        "google.gemini-3.1-pro-preview",
        "vertex_ai/gemini-3.1-pro-preview",
        "google/gemini-3.1-pro-preview",
        "nto.google.gemini-3.1-pro-preview",
    ),
    "gemini/gemini-3.1-flash-lite-preview": (
        "gemini/gemini-3.1-flash-lite-preview",
        "google.gemini-3.1-flash-lite-preview",
        "vertex_ai/gemini-3.1-flash-lite-preview",
        "google/gemini-3.1-flash-lite-preview",
        "nto.google.gemini-3.1-flash-lite-preview",
    ),
    "anthropic/claude-opus-4-6": (
        "anthropic/claude-opus-4-6",
        "anthropic.claude-4.6-opus",
        "bedrock/global.anthropic.claude-opus-4-6-v1",
        "bedrock/us.anthropic.claude-opus-4-6-v1",
        "anthropic/claude-4.6-opus",
    ),
}

MODEL_MATCH_TOKENS: dict[str, tuple[str, ...]] = {
    "gpt-5.3-codex": ("gpt", "5", "3", "codex"),
    "chatgpt/gpt-5.2": ("gpt", "5", "2"),
    "gemini/gemini-3.1-pro-preview": ("gemini", "3", "1", "pro", "preview"),
    "gemini/gemini-3.1-flash-lite-preview": ("gemini", "3", "1", "flash", "lite", "preview"),
    "anthropic/claude-opus-4-6": ("claude", "opus", "4", "6"),
}

MODEL_EXCLUDED_TOKENS: dict[str, tuple[str, ...]] = {
    "chatgpt/gpt-5.2": ("codex",),
}

MODEL_PREFIX_PRIORITY: dict[str, tuple[str, ...]] = {
    "gpt-5.3-codex": ("openai.", "openai/", "azure/", "azure_ai/"),
    "chatgpt/gpt-5.2": ("openai.", "openai/", "azure/", "azure_ai/"),
    "gemini/gemini-3.1-pro-preview": ("google.", "google/", "vertex_ai/", "nto.google."),
    "gemini/gemini-3.1-flash-lite-preview": ("google.", "google/", "vertex_ai/", "nto.google."),
    "anthropic/claude-opus-4-6": ("anthropic.", "anthropic/", "bedrock/global.", "bedrock/us."),
}


class _HTTPResponse(Protocol):
    status_code: int

    def json(self) -> dict[str, Any]: ...


@dataclass(frozen=True)
class CatalogSnapshot:
    required_models: tuple[str, ...]
    available_models: frozenset[str]
    resolved_models_by_required: dict[str, str]
    missing_required_models: tuple[str, ...]
    defaults_by_agent: dict[str, str]

    def to_response(self) -> ModelOptionsResponse:
        return ModelOptionsResponse(
            required_models=list(self.required_models),
            defaults_by_agent=dict(self.defaults_by_agent),
            options=[
                ModelOptionStatus(
                    model=model_id,
                    available=(model_id in self.resolved_models_by_required),
                    resolved_model=self.resolved_models_by_required.get(model_id),
                )
                for model_id in self.required_models
            ],
        )


class _UrllibResponse:
    def __init__(self, status_code: int, payload: dict[str, Any]) -> None:
        self.status_code = status_code
        self._payload = payload

    def json(self) -> dict[str, Any]:
        return self._payload


def _default_http_get(url: str, *, headers: dict[str, str], timeout: float) -> _HTTPResponse:
    req = urllib_request.Request(url, method="GET", headers=headers)
    try:
        with urllib_request.urlopen(req, timeout=timeout) as response:
            status_code = int(getattr(response, "status", 200))
            body = response.read().decode("utf-8")
    except urllib_error.HTTPError as exc:
        body = exc.read().decode("utf-8")
        try:
            payload = json.loads(body) if body else {}
        except json.JSONDecodeError:
            payload = {}
        return _UrllibResponse(status_code=exc.code, payload=payload)
    except urllib_error.URLError as exc:
        raise RuntimeError("provider_litellm_model_info_unavailable") from exc

    try:
        payload = json.loads(body) if body else {}
    except json.JSONDecodeError as exc:
        raise RuntimeError("provider_litellm_model_info_invalid_json") from exc
    return _UrllibResponse(status_code=status_code, payload=payload)


def parse_model_ids(payload: dict[str, Any]) -> set[str]:
    data = payload.get("data")
    if not isinstance(data, list):
        return set()

    model_ids: set[str] = set()
    for item in data:
        if not isinstance(item, dict):
            continue
        model_name = item.get("model_name")
        if isinstance(model_name, str) and model_name.strip():
            model_ids.add(model_name.strip())

        litellm_params = item.get("litellm_params")
        if isinstance(litellm_params, dict):
            inner_model = litellm_params.get("model")
            if isinstance(inner_model, str) and inner_model.strip():
                model_ids.add(inner_model.strip())

    return model_ids


def _normalize_tokens(model_id: str) -> tuple[str, ...]:
    normalized = re.sub(r"[^a-z0-9]+", "-", model_id.lower()).strip("-")
    if not normalized:
        return ()
    return tuple(token for token in normalized.split("-") if token)


def resolve_required_model(available_models: set[str] | frozenset[str], required_model_id: str) -> str | None:
    aliases = MODEL_ID_ALIASES.get(required_model_id, (required_model_id,))
    for alias in aliases:
        if alias in available_models:
            return alias

    required_tokens = MODEL_MATCH_TOKENS.get(required_model_id)
    if required_tokens is None:
        return None
    excluded_tokens = set(MODEL_EXCLUDED_TOKENS.get(required_model_id, ()))

    candidates: list[str] = []
    for model_id in available_models:
        tokens = set(_normalize_tokens(model_id))
        if not tokens:
            continue
        if not set(required_tokens).issubset(tokens):
            continue
        if excluded_tokens.intersection(tokens):
            continue
        candidates.append(model_id)
    if not candidates:
        return None

    priority_prefixes = MODEL_PREFIX_PRIORITY.get(required_model_id, ())
    for prefix in priority_prefixes:
        for model_id in sorted(candidates):
            if model_id.startswith(prefix):
                return model_id
    return sorted(candidates)[0]


def resolve_required_models(available_models: set[str] | frozenset[str]) -> dict[str, str]:
    resolved: dict[str, str] = {}
    for required_model_id in REQUIRED_MODEL_IDS:
        resolved_model = resolve_required_model(available_models, required_model_id)
        if resolved_model is not None:
            resolved[required_model_id] = resolved_model
    return resolved


def fetch_model_catalog(
    *,
    base_url: str,
    api_key: str,
    http_get: Callable[..., _HTTPResponse] = _default_http_get,
) -> CatalogSnapshot:
    normalized_base_url = (base_url or "").strip().rstrip("/")
    normalized_api_key = (api_key or "").strip()
    if not normalized_base_url:
        raise RuntimeError("provider_litellm_base_url_missing")
    if not normalized_api_key:
        raise RuntimeError("provider_litellm_api_key_missing")

    response = http_get(
        f"{normalized_base_url}/v1/model/info",
        headers={"Authorization": f"Bearer {normalized_api_key}"},
        timeout=10.0,
    )
    if int(response.status_code) >= 400:
        raise RuntimeError("provider_litellm_model_info_unavailable")

    payload = response.json()
    if not isinstance(payload, dict):
        raise RuntimeError("provider_litellm_model_info_invalid_payload")

    available_models = frozenset(parse_model_ids(payload))
    resolved_models = resolve_required_models(available_models)
    missing = tuple(sorted(model_id for model_id in REQUIRED_MODEL_IDS if model_id not in resolved_models))
    if missing:
        joined = ",".join(missing)
        raise RuntimeError(f"provider_litellm_required_models_missing:{joined}")

    return CatalogSnapshot(
        required_models=REQUIRED_MODEL_IDS,
        available_models=available_models,
        resolved_models_by_required=resolved_models,
        missing_required_models=missing,
        defaults_by_agent=DEFAULT_MODEL_BY_AGENT,
    )


@lru_cache(maxsize=1)
def get_model_catalog_snapshot() -> CatalogSnapshot:
    settings = get_settings()
    return fetch_model_catalog(
        base_url=settings.litellm_base_url or "",
        api_key=settings.litellm_api_key or "",
    )


def get_model_options_snapshot() -> ModelOptionsResponse:
    snapshot = get_model_catalog_snapshot()
    return snapshot.to_response()


def clear_model_catalog_cache() -> None:
    get_model_catalog_snapshot.cache_clear()
