from __future__ import annotations

from app.services.store import store


def get_cached(scope: str, key: str | None):
    if not key:
        return None
    return store.get_idempotent(scope, key)


def set_cached(scope: str, key: str | None, payload: dict):
    if not key:
        return
    store.put_idempotent(scope, key, payload)
