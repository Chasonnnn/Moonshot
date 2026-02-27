from __future__ import annotations

import json

from app.core.config import get_settings


def _fetch_secret_string(secret_id: str) -> str:
    settings = get_settings()
    try:
        import boto3  # type: ignore
    except ImportError as exc:
        raise RuntimeError("secrets_manager_sdk_missing") from exc

    client = boto3.client("secretsmanager", region_name=settings.managed_secrets_region)
    response = client.get_secret_value(SecretId=secret_id)
    secret = response.get("SecretString")
    if not isinstance(secret, str) or not secret.strip():
        raise RuntimeError("secrets_manager_empty_secret")
    return secret.strip()


def load_managed_secrets() -> None:
    settings = get_settings()
    if not settings.managed_secrets_enabled:
        if settings.managed_secrets_required:
            raise RuntimeError("managed_secrets_required")
        return

    if settings.jwt_signing_keys_secret_id:
        raw = _fetch_secret_string(settings.jwt_signing_keys_secret_id)
        payload = json.loads(raw)
        if not isinstance(payload, dict) or not payload:
            raise RuntimeError("jwt_signing_keys_secret_invalid")
        settings.jwt_signing_keys = {str(key): str(value) for key, value in payload.items()}

    if settings.gemini_api_key_secret_id and not settings.gemini_api_key:
        settings.gemini_api_key = _fetch_secret_string(settings.gemini_api_key_secret_id)

    if settings.managed_secrets_required:
        if not settings.jwt_signing_keys:
            raise RuntimeError("jwt_signing_keys_missing")
