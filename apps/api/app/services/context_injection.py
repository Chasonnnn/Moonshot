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
) -> ContextInjectionTrace:
    trace = ContextInjectionTrace(
        session_id=session_id,
        tenant_id=tenant_id,
        agent_type=agent_type,
        actor_role=actor_role,
        mode=mode,
        context_keys=context_keys,
        policy_version=policy_version,
    )
    store.context_injection_traces.setdefault(session_id, []).append(trace.model_dump(mode="json"))
    return trace


def list_context_traces(session_id: UUID) -> list[ContextInjectionTrace]:
    payloads = store.context_injection_traces.get(session_id, [])
    return [ContextInjectionTrace.model_validate(item) for item in payloads]
