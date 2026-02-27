import pytest

from app.core.config import get_settings
from app.providers.registry import get_codesign_provider


def test_unknown_provider_has_no_fallback(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "model_provider", "unsupported-provider")

    with pytest.raises(RuntimeError, match="unsupported_model_provider"):
        get_codesign_provider()
