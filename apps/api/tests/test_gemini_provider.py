import pytest

from app.core.config import get_settings
from app.providers.gemini import GeminiProvider


class _FakeGenerateResponse:
    def __init__(self, text: str) -> None:
        self.text = text


class _FakeModels:
    def __init__(self) -> None:
        self.calls: list[dict[str, str]] = []

    def generate_content(self, *, model: str, contents: str):
        self.calls.append({"model": model, "contents": contents})
        return _FakeGenerateResponse("model-generated-content")


class _FakeClient:
    def __init__(self) -> None:
        self.models = _FakeModels()


def test_gemini_provider_requires_api_key(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "gemini_api_key", None)

    with pytest.raises(RuntimeError, match="gemini_api_key_missing"):
        GeminiProvider()


def test_gemini_provider_calls_sdk_generate_content(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "gemini_api_key", "test-gemini-key")
    monkeypatch.setattr(settings, "gemini_model", "gemini-2.5-pro")

    fake_client = _FakeClient()
    provider = GeminiProvider(client=fake_client)
    output = provider.generate_variant("Create a task variant for KPI investigation.")

    assert output.provider == "gemini"
    assert output.model == "gemini-2.5-pro"
    assert output.content == "model-generated-content"
    assert len(fake_client.models.calls) == 1
    assert fake_client.models.calls[0]["contents"] == "Create a task variant for KPI investigation."
