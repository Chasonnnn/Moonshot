from __future__ import annotations

from uuid import UUID

from app.schemas import ContextInjectionTrace
from app.services.store import store


def append_context_trace(
    *,
    session_id: UUID,
    tenant_id: str,
    agent_type: str,
    actor_role: str,
    mode: str,
    context_keys: list[str],
    policy_version: str | None = None,
    policy_hash: str | None = None,
    memory_entry_ids: list[UUID] | None = None,
    chunk_ids: list[UUID] | None = None,
    ranking_features: dict[str, object] | None = None,
    query_text: str | None = None,
    token_budget: int | None = None,
    assembled_context_hash: str | None = None,
) -> ContextInjectionTrace:
    trace = ContextInjectionTrace(
        session_id=session_id,
        tenant_id=tenant_id,
        agent_type=agent_type,
        actor_role=actor_role,
        mode=mode,
        context_keys=context_keys,
        policy_version=policy_version,
        policy_hash=policy_hash,
        memory_entry_ids=memory_entry_ids or [],
        chunk_ids=chunk_ids or [],
        ranking_features=ranking_features or {},
        query_text=query_text,
        token_budget=token_budget,
        assembled_context_hash=assembled_context_hash,
    )
    store.context_injection_traces[trace.id] = trace.model_dump(mode="json")
    return trace


def list_context_traces(session_id: UUID) -> list[ContextInjectionTrace]:
    payloads = [item for item in store.context_injection_traces.values() if item.get("session_id") == str(session_id)]
    traces = [ContextInjectionTrace.model_validate(item) for item in payloads]
    return sorted(traces, key=lambda item: item.created_at)
