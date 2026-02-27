import pytest

from app.core.config import get_settings
from app.core.secrets import load_managed_secrets


def test_managed_secrets_raises_when_required_but_disabled():
    settings = get_settings()
    prior_enabled = settings.managed_secrets_enabled
    prior_required = settings.managed_secrets_required
    try:
        settings.managed_secrets_enabled = False
        settings.managed_secrets_required = True
        with pytest.raises(RuntimeError, match="managed_secrets_required"):
            load_managed_secrets()
    finally:
        settings.managed_secrets_enabled = prior_enabled
        settings.managed_secrets_required = prior_required


def test_managed_secrets_noop_when_optional_and_disabled():
    settings = get_settings()
    prior_enabled = settings.managed_secrets_enabled
    prior_required = settings.managed_secrets_required
    try:
        settings.managed_secrets_enabled = False
        settings.managed_secrets_required = False
        load_managed_secrets()
    finally:
        settings.managed_secrets_enabled = prior_enabled
        settings.managed_secrets_required = prior_required
