import pytest

from app.providers.model_catalog import (
    REQUIRED_MODEL_IDS,
    fetch_model_catalog,
    parse_model_ids,
    resolve_required_model,
)


class _FakeResponse:
    def __init__(self, status_code: int, payload: dict) -> None:
        self.status_code = status_code
        self._payload = payload

    def json(self) -> dict:
        return self._payload


def test_parse_model_ids_reads_model_name_and_litellm_params_model():
    payload = {
        "data": [
            {"model_name": "chatgpt/gpt-5.2"},
            {"litellm_params": {"model": "gpt-5.3-codex"}},
            {"model_name": "anthropic/claude-opus-4-6", "litellm_params": {"model": "anthropic/claude-opus-4-6"}},
            {"model_name": 1234, "litellm_params": {"model": None}},
        ]
    }

    ids = parse_model_ids(payload)

    assert "chatgpt/gpt-5.2" in ids
    assert "gpt-5.3-codex" in ids
    assert "anthropic/claude-opus-4-6" in ids
    assert "1234" not in ids


def test_fetch_model_catalog_returns_snapshot_when_required_models_present():
    payload = {
        "data": [
            {"model_name": model_id}
            for model_id in REQUIRED_MODEL_IDS
        ]
    }

    def _http_get(url: str, *, headers: dict[str, str], timeout: float) -> _FakeResponse:
        assert url == "https://litellm.local/v1/model/info"
        assert headers["Authorization"] == "Bearer sk-test"
        assert timeout == 10.0
        return _FakeResponse(200, payload)

    snapshot = fetch_model_catalog(
        base_url="https://litellm.local",
        api_key="sk-test",
        http_get=_http_get,
    )

    assert set(snapshot.required_models) == set(REQUIRED_MODEL_IDS)
    assert set(snapshot.available_models) >= set(REQUIRED_MODEL_IDS)
    assert snapshot.resolved_models_by_required == {model_id: model_id for model_id in REQUIRED_MODEL_IDS}
    assert snapshot.missing_required_models == ()


def test_fetch_model_catalog_resolves_provider_prefixed_model_ids():
    payload = {
        "data": [
            {"model_name": "openai.gpt-5.3-codex", "litellm_params": {"model": "azure/gpt-5.3-codex"}},
            {"model_name": "openai.gpt-5.2", "litellm_params": {"model": "azure/gpt-5.2-2025-12-11"}},
            {
                "model_name": "google.gemini-3.1-pro-preview",
                "litellm_params": {"model": "vertex_ai/gemini-3.1-pro-preview"},
            },
            {
                "model_name": "google.gemini-3.1-flash-lite-preview",
                "litellm_params": {"model": "vertex_ai/gemini-3.1-flash-lite-preview"},
            },
            {
                "model_name": "anthropic.claude-4.6-opus",
                "litellm_params": {"model": "bedrock/global.anthropic.claude-opus-4-6-v1"},
            },
        ]
    }

    def _http_get(_url: str, *, headers: dict[str, str], timeout: float) -> _FakeResponse:
        assert headers["Authorization"] == "Bearer sk-test"
        assert timeout == 10.0
        return _FakeResponse(200, payload)

    snapshot = fetch_model_catalog(
        base_url="https://litellm.local",
        api_key="sk-test",
        http_get=_http_get,
    )

    assert snapshot.resolved_models_by_required["gpt-5.3-codex"] == "openai.gpt-5.3-codex"
    assert snapshot.resolved_models_by_required["chatgpt/gpt-5.2"] == "openai.gpt-5.2"
    assert snapshot.resolved_models_by_required["gemini/gemini-3.1-pro-preview"] == "google.gemini-3.1-pro-preview"
    assert snapshot.resolved_models_by_required["gemini/gemini-3.1-flash-lite-preview"] == "google.gemini-3.1-flash-lite-preview"
    assert snapshot.resolved_models_by_required["anthropic/claude-opus-4-6"] == "anthropic.claude-4.6-opus"


def test_fetch_model_catalog_fails_when_required_models_missing():
    payload = {"data": [{"model_name": "gpt-5.3-codex"}]}

    def _http_get(_url: str, *, headers: dict[str, str], timeout: float) -> _FakeResponse:
        assert headers["Authorization"] == "Bearer sk-test"
        assert timeout == 10.0
        return _FakeResponse(200, payload)

    with pytest.raises(RuntimeError, match="provider_litellm_required_models_missing"):
        fetch_model_catalog(
            base_url="https://litellm.local",
            api_key="sk-test",
            http_get=_http_get,
        )


def test_resolve_required_model_prefers_non_codex_variant_for_chatgpt_5_2():
    available = {"openai.gpt-5.2-codex", "openai.gpt-5.2-chat"}
    resolved = resolve_required_model(available, "chatgpt/gpt-5.2")
    assert resolved == "openai.gpt-5.2-chat"
