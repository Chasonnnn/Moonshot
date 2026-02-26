from __future__ import annotations

from copy import deepcopy
from threading import Lock
from typing import Any
from uuid import UUID


class InMemoryStore:
    def __init__(self) -> None:
        self._lock = Lock()
        self.business_context_packs: dict[UUID, dict[str, Any]] = {}
        self.cases: dict[UUID, dict[str, Any]] = {}
        self.task_families: dict[UUID, dict[str, Any]] = {}
        self.rubrics: dict[UUID, dict[str, Any]] = {}
        self.sessions: dict[UUID, dict[str, Any]] = {}
        self.session_events: dict[UUID, list[dict[str, Any]]] = {}
        self.scores: dict[UUID, dict[str, Any]] = {}
        self.reports: dict[UUID, dict[str, Any]] = {}
        self.exports: dict[UUID, dict[str, Any]] = {}
        self.redteam_runs: dict[UUID, dict[str, Any]] = {}
        self.audit_logs: list[dict[str, Any]] = []
        self.idempotency_cache: dict[tuple[str, str], dict[str, Any]] = {}

    def with_lock(self, fn):
        with self._lock:
            return fn()

    def put_idempotent(self, scope: str, key: str, payload: dict[str, Any]) -> None:
        self.idempotency_cache[(scope, key)] = deepcopy(payload)

    def get_idempotent(self, scope: str, key: str) -> dict[str, Any] | None:
        value = self.idempotency_cache.get((scope, key))
        if value is None:
            return None
        return deepcopy(value)


store = InMemoryStore()
