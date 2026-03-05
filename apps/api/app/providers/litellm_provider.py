from __future__ import annotations

import hashlib
import time
from typing import Any, Callable, Literal

from app.core.config import get_settings
from app.providers.contracts import CoDesignProvider, CoachProvider, EvaluatorProvider, ProviderOutput
from app.providers.model_catalog import (
    DEFAULT_MODEL_BY_AGENT,
    REQUIRED_MODEL_IDS,
    XHIGH_ALLOWED_MODELS,
    get_model_catalog_snapshot,
)

AgentType = Literal["codesign", "coach", "evaluator"]
ReasoningEffort = Literal["low", "medium", "high", "xhigh"]

_ALLOWED_REASONING: set[str] = {"low", "medium", "high", "xhigh"}
_REASONING_EFFORT_MODELS: frozenset[str] = frozenset({"gpt-5.3-codex", "chatgpt/gpt-5.2"})


def _default_completion_fn(**kwargs):
    try:
        from litellm import completion  # type: ignore
    except ImportError as exc:
        raise RuntimeError("provider_litellm_sdk_missing") from exc

    return completion(**kwargs)


def _extract_text(response: Any) -> str:
    if isinstance(response, dict):
        choices = response.get("choices")
        if isinstance(choices, list) and choices:
            first = choices[0] if isinstance(choices[0], dict) else {}
            message = first.get("message") if isinstance(first, dict) else None
            if isinstance(message, dict):
                content = message.get("content")
                if isinstance(content, str) and content.strip():
                    return content.strip()
                if isinstance(content, list):
                    text_parts: list[str] = []
                    for item in content:
                        if not isinstance(item, dict):
                            continue
                        text = item.get("text")
                        if isinstance(text, str) and text.strip():
                            text_parts.append(text.strip())
                    if text_parts:
                        return "\n".join(text_parts)

        output_text = response.get("output_text")
        if isinstance(output_text, str) and output_text.strip():
            return output_text.strip()
    else:
        choices = getattr(response, "choices", None)
        if isinstance(choices, list) and choices:
            first = choices[0]
            message = getattr(first, "message", None)
            if message is not None:
                content = getattr(message, "content", None)
                if isinstance(content, str) and content.strip():
                    return content.strip()
        output_text = getattr(response, "output_text", None)
        if isinstance(output_text, str) and output_text.strip():
            return output_text.strip()

    raise RuntimeError("provider_litellm_empty_response")


class LiteLLMProvider(CoDesignProvider, CoachProvider, EvaluatorProvider):
    def __init__(
        self,
        *,
        agent_type: AgentType,
        model_override: str | None = None,
        reasoning_effort: str | None = None,
        thinking_budget_tokens: int | None = None,
        completion_fn: Callable[..., Any] | None = None,
        available_models: set[str] | None = None,
        resolved_models_by_required: dict[str, str] | None = None,
    ) -> None:
        settings = get_settings()
        self._base_url = (settings.litellm_base_url or "").strip()
        self._api_key = (settings.litellm_api_key or "").strip()
        self._request_timeout_seconds = max(5.0, float(settings.provider_request_timeout_seconds))
        if not self._base_url:
            raise RuntimeError("provider_litellm_base_url_missing")
        if not self._api_key:
            raise RuntimeError("provider_litellm_api_key_missing")

        catalog_models = set(available_models or set())
        resolved_map = dict(resolved_models_by_required or {})
        if not catalog_models:
            snapshot = get_model_catalog_snapshot()
            catalog_models = set(snapshot.available_models)
            resolved_map = dict(snapshot.resolved_models_by_required)

        default_model = DEFAULT_MODEL_BY_AGENT[agent_type]
        candidate_model = (model_override or "").strip() or default_model
        if candidate_model not in REQUIRED_MODEL_IDS:
            raise RuntimeError("provider_model_not_allowed")

        resolved_model = resolved_map.get(candidate_model)
        if resolved_model is None and candidate_model in catalog_models:
            resolved_model = candidate_model
        if resolved_model is None:
            raise RuntimeError("provider_model_unavailable")
        if resolved_model not in catalog_models:
            raise RuntimeError("provider_model_unavailable")

        resolved_effort = (reasoning_effort or "high").strip().lower()
        if resolved_effort not in _ALLOWED_REASONING:
            raise RuntimeError("provider_reasoning_effort_invalid")
        if resolved_effort == "xhigh" and candidate_model not in XHIGH_ALLOWED_MODELS:
            raise RuntimeError("provider_reasoning_effort_not_supported")

        if thinking_budget_tokens is not None and thinking_budget_tokens <= 0:
            raise RuntimeError("provider_thinking_budget_invalid")
        if thinking_budget_tokens is not None and candidate_model != "anthropic/claude-opus-4-6":
            raise RuntimeError("provider_thinking_budget_not_supported")

        self.agent_type = agent_type
        self.model = candidate_model
        self._resolved_model = resolved_model
        self.reasoning_effort: ReasoningEffort = resolved_effort  # type: ignore[assignment]
        self.thinking_budget_tokens = thinking_budget_tokens
        self._completion = completion_fn or _default_completion_fn

    def _invoke(self, prompt: str) -> ProviderOutput:
        started = time.perf_counter_ns()
        prompt_hash = hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:16]

        request_kwargs: dict[str, Any] = {
            "model": self._resolved_model,
            "messages": [{"role": "user", "content": prompt}],
            "base_url": self._base_url,
            "api_key": self._api_key,
            "timeout": self._request_timeout_seconds,
            # LiteLLM proxy is OpenAI-compatible; force OpenAI transport for proxy aliases.
            "custom_llm_provider": "openai",
        }
        if self.model == "anthropic/claude-opus-4-6":
            if self.thinking_budget_tokens is None:
                request_kwargs["extra_body"] = {"thinking": {"type": "adaptive"}}
            else:
                request_kwargs["extra_body"] = {
                    "thinking": {
                        "type": "enabled",
                        "budget_tokens": self.thinking_budget_tokens,
                    }
                }
        elif self.model in _REASONING_EFFORT_MODELS:
            if self.reasoning_effort == "xhigh":
                request_kwargs["extra_body"] = {"reasoning_effort": self.reasoning_effort}
            else:
                request_kwargs["reasoning_effort"] = self.reasoning_effort

        response = self._completion(**request_kwargs)
        content = _extract_text(response)
        latency_ms = max(1, int((time.perf_counter_ns() - started) / 1_000_000))
        return ProviderOutput(
            content=content,
            model=self.model,
            provider="litellm",
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
