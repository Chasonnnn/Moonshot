import pytest

from app.core.config import get_settings
from app.providers.litellm_provider import LiteLLMProvider
from app.providers.model_catalog import REQUIRED_MODEL_IDS


def _base_settings(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "litellm_base_url", "https://litellm.local/v1")
    monkeypatch.setattr(settings, "litellm_api_key", "sk-test")
    monkeypatch.setattr(settings, "provider_request_timeout_seconds", 45.0)
    return settings


def test_codesign_provider_uses_default_model_and_reasoning_effort(monkeypatch):
    _base_settings(monkeypatch)
    captured: dict = {}

    def _completion(**kwargs):
        captured.update(kwargs)
        return {"choices": [{"message": {"content": "model-generated-content"}}]}

    provider = LiteLLMProvider(
        agent_type="codesign",
        completion_fn=_completion,
        available_models=set(REQUIRED_MODEL_IDS),
    )

    output = provider.generate_variant("Create a task variant for KPI investigation.")

    assert output.provider == "litellm"
    assert output.model == "gpt-5.3-codex"
    assert output.content == "model-generated-content"
    assert captured["model"] == "gpt-5.3-codex"
    assert captured["reasoning_effort"] == "high"
    assert captured["base_url"] == "https://litellm.local/v1"
    assert captured["api_key"] == "sk-test"
    assert captured["timeout"] == 45.0
    assert captured["messages"][0]["content"] == "Create a task variant for KPI investigation."


def test_provider_calls_resolved_proxy_model_id(monkeypatch):
    _base_settings(monkeypatch)
    captured: dict = {}

    def _completion(**kwargs):
        captured.update(kwargs)
        return {"choices": [{"message": {"content": "model-generated-content"}}]}

    provider = LiteLLMProvider(
        agent_type="codesign",
        completion_fn=_completion,
        available_models={"openai.gpt-5.3-codex"},
        resolved_models_by_required={"gpt-5.3-codex": "openai.gpt-5.3-codex"},
    )

    output = provider.generate_variant("Generate.")

    assert output.model == "gpt-5.3-codex"
    assert captured["model"] == "openai.gpt-5.3-codex"
    assert captured["custom_llm_provider"] == "openai"


def test_xhigh_is_rejected_for_models_not_allowlisted(monkeypatch):
    _base_settings(monkeypatch)

    with pytest.raises(RuntimeError, match="provider_reasoning_effort_not_supported"):
        LiteLLMProvider(
            agent_type="codesign",
            model_override="gemini/gemini-3.1-pro-preview",
            reasoning_effort="xhigh",
            completion_fn=lambda **kwargs: kwargs,
            available_models=set(REQUIRED_MODEL_IDS),
        )


def test_claude_46_maps_thinking_budget(monkeypatch):
    _base_settings(monkeypatch)
    captured: dict = {}

    def _completion(**kwargs):
        captured.update(kwargs)
        return {"choices": [{"message": {"content": "json-response"}}]}

    provider = LiteLLMProvider(
        agent_type="evaluator",
        thinking_budget_tokens=2048,
        completion_fn=_completion,
        available_models=set(REQUIRED_MODEL_IDS),
    )

    output = provider.score_dimension("Score this candidate response.")

    assert output.model == "anthropic/claude-opus-4-6"
    assert captured["custom_llm_provider"] == "openai"
    assert captured["extra_body"] == {"thinking": {"type": "enabled", "budget_tokens": 2048}}
    assert "reasoning_effort" not in captured


def test_claude_46_uses_adaptive_thinking_by_default(monkeypatch):
    _base_settings(monkeypatch)
    captured: dict = {}

    def _completion(**kwargs):
        captured.update(kwargs)
        return {"choices": [{"message": {"content": "json-response"}}]}

    provider = LiteLLMProvider(
        agent_type="evaluator",
        completion_fn=_completion,
        available_models=set(REQUIRED_MODEL_IDS),
    )

    provider.score_holistic("Score this candidate response holistically.")

    assert captured["model"] == "anthropic/claude-opus-4-6"
    assert captured["custom_llm_provider"] == "openai"
    assert captured["extra_body"] == {"thinking": {"type": "adaptive"}}
    assert "reasoning_effort" not in captured


def test_gemini_override_omits_reasoning_effort_payload(monkeypatch):
    _base_settings(monkeypatch)
    captured: dict = {}

    def _completion(**kwargs):
        captured.update(kwargs)
        return {"choices": [{"message": {"content": "gemini-response"}}]}

    provider = LiteLLMProvider(
        agent_type="codesign",
        model_override="gemini/gemini-3.1-pro-preview",
        reasoning_effort="high",
        completion_fn=_completion,
        available_models={"google.gemini-3.1-pro-preview"},
        resolved_models_by_required={"gemini/gemini-3.1-pro-preview": "google.gemini-3.1-pro-preview"},
    )

    provider.generate_variant("Generate.")

    assert captured["model"] == "google.gemini-3.1-pro-preview"
    assert captured["custom_llm_provider"] == "openai"
    assert "reasoning_effort" not in captured


def test_chatgpt_52_xhigh_uses_extra_body_pass_through(monkeypatch):
    _base_settings(monkeypatch)
    captured: dict = {}

    def _completion(**kwargs):
        captured.update(kwargs)
        return {"choices": [{"message": {"content": "ok"}}]}

    provider = LiteLLMProvider(
        agent_type="coach",
        reasoning_effort="xhigh",
        completion_fn=_completion,
        available_models={"openai.gpt-5.2"},
        resolved_models_by_required={"chatgpt/gpt-5.2": "openai.gpt-5.2"},
    )

    provider.contextual_hint("Hint")

    assert captured["model"] == "openai.gpt-5.2"
    assert captured["extra_body"] == {"reasoning_effort": "xhigh"}
    assert "reasoning_effort" not in captured


def test_codex_53_xhigh_uses_extra_body_pass_through(monkeypatch):
    _base_settings(monkeypatch)
    captured: dict = {}

    def _completion(**kwargs):
        captured.update(kwargs)
        return {"choices": [{"message": {"content": "ok"}}]}

    provider = LiteLLMProvider(
        agent_type="codesign",
        reasoning_effort="xhigh",
        completion_fn=_completion,
        available_models={"openai.gpt-5.3-codex"},
        resolved_models_by_required={"gpt-5.3-codex": "openai.gpt-5.3-codex"},
    )

    provider.generate_variant("Generate")

    assert captured["model"] == "openai.gpt-5.3-codex"
    assert captured["extra_body"] == {"reasoning_effort": "xhigh"}
    assert "reasoning_effort" not in captured
