from __future__ import annotations

import hashlib
import math
import re
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, MutableMapping
from uuid import NAMESPACE_URL, UUID, uuid5

from app.providers.embedding_provider import EmbeddingProvider, get_embedding_provider
from app.schemas import (
    BusinessContextPack,
    HumanReviewRecord,
    InterpretationView,
    MemoryAssemblerRequest,
    MemoryChunk,
    MemoryEntry,
    SessionMemoryDigest,
    TaskQualitySignal,
)
from app.services.repositories import case_repository, scoring_repository, session_repository
from app.services.store import store

_TOKEN_PATTERN = re.compile(r"[a-z0-9_]+")
_ENTRY_STATUS_BY_SOURCE_STATUS = {
    "draft": "proposed",
    "review": "reviewed",
    "reviewed": "reviewed",
    "approved": "approved",
    "active": "active",
    "published": "active",
    "deprecated": "deprecated",
    "retired": "deprecated",
}
_CONSUMER_POLICIES: dict[str, dict[str, Any]] = {
    "coach": {
        "layers": ("org", "content", "episode"),
        "max_chunks": 5,
        "token_budget": 1500,
        "allowed_sources": {
            "business_context_pack",
            "case_spec",
            "task_family",
            "rubric",
            "session_digest",
        },
    },
    "evaluator": {
        "layers": ("org", "content", "episode"),
        "max_chunks": 10,
        "token_budget": 4000,
        "allowed_sources": {
            "business_context_pack",
            "case_spec",
            "task_family",
            "rubric",
            "task_quality_signal",
            "session_digest",
            "human_review",
            "interpretation_view",
        },
    },
    "codesign": {
        "layers": ("org", "content"),
        "max_chunks": 12,
        "token_budget": 5000,
        "allowed_sources": {
            "business_context_pack",
            "task_family",
            "rubric",
            "task_quality_signal",
        },
    },
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_tokens(text: str) -> list[str]:
    return _TOKEN_PATTERN.findall(text.lower())


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    return round(sum(left * right for left, right in zip(a, b)), 6)


def _fts_score(query_text: str, document_text: str) -> float:
    query_tokens = set(_normalize_tokens(query_text))
    document_tokens = set(_normalize_tokens(document_text))
    if not query_tokens or not document_tokens:
        return 0.0
    overlap = len(query_tokens & document_tokens)
    return round(overlap / len(query_tokens), 6)


def _recency_boost(updated_at: datetime) -> float:
    age_hours = max(0.0, (_now() - updated_at).total_seconds() / 3600.0)
    return round(1.0 / (1.0 + (age_hours / 24.0)), 6)


def _review_weight(entry: MemoryEntry) -> float:
    weight = 0.0
    if entry.reviewed_by:
        weight += 0.12
    if entry.source_type == "admin_approved":
        weight += 0.08
    if entry.source_entity_type == "human_review":
        weight += 0.2
    if entry.layer == "org":
        weight += 0.03
    return round(weight, 6)


def _consumer_policy(consumer: str) -> dict[str, Any]:
    resolved = _CONSUMER_POLICIES.get(consumer)
    if resolved is None:
        raise RuntimeError("memory_consumer_unsupported")
    return resolved


def _entry_id(layer: str, source_entity_type: str, source_entity_id: str) -> UUID:
    return uuid5(NAMESPACE_URL, f"memory-entry:{layer}:{source_entity_type}:{source_entity_id}")


def _chunk_id(entry_id: UUID, chunk_index: int) -> UUID:
    return uuid5(NAMESPACE_URL, f"memory-chunk:{entry_id}:{chunk_index}")


def _split_chunks(text: str, *, max_chars: int = 500) -> list[str]:
    cleaned = " ".join(text.split())
    if not cleaned:
        return []
    chunks: list[str] = []
    current = ""
    for sentence in re.split(r"(?<=[.!?])\s+", cleaned):
        candidate = sentence.strip()
        if not candidate:
            continue
        next_chunk = candidate if not current else f"{current} {candidate}"
        if len(next_chunk) <= max_chars:
            current = next_chunk
            continue
        if current:
            chunks.append(current)
        if len(candidate) <= max_chars:
            current = candidate
            continue
        for idx in range(0, len(candidate), max_chars):
            chunks.append(candidate[idx : idx + max_chars])
        current = ""
    if current:
        chunks.append(current)
    return chunks or [cleaned[:max_chars]]


def _entry_updated_at(entry: MemoryEntry) -> datetime:
    return _ensure_utc(
        entry.updated_at if isinstance(entry.updated_at, datetime) else datetime.fromisoformat(str(entry.updated_at))
    )


def _chunk_updated_at(chunk: MemoryChunk) -> datetime:
    return _ensure_utc(
        chunk.updated_at if isinstance(chunk.updated_at, datetime) else datetime.fromisoformat(str(chunk.updated_at))
    )


def _ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _visibility_scope_for(source_entity_type: str) -> list[str]:
    if source_entity_type in {"human_review", "interpretation_view", "task_quality_signal"}:
        return ["reviewer", "org_admin"]
    return ["candidate", "reviewer", "org_admin"]


def _memory_entry_status(source_status: str) -> str:
    return _ENTRY_STATUS_BY_SOURCE_STATUS.get(source_status, "proposed")


def _pack_text(pack: BusinessContextPack) -> str:
    examples = "; ".join(pack.examples)
    return (
        f"Pack name: {pack.name}. Role focus: {pack.role_focus}. "
        f"Job description: {pack.job_description}. "
        f"Examples: {examples}. Constraints: {pack.constraints}."
    ).strip()


def _case_text(case_payload: Any) -> str:
    artifacts = ", ".join(str(item.get("type", "unknown")) for item in case_payload.artifacts)
    tools = ", ".join(case_payload.allowed_tools)
    return (
        f"Case title: {case_payload.title}. Scenario: {case_payload.scenario}. "
        f"Artifacts: {artifacts}. Allowed tools: {tools}."
    ).strip()


def _task_family_text(task_family: Any) -> str:
    prompt_text = " ".join(variant.prompt for variant in task_family.variants[:4])
    return (
        f"Task family version: {task_family.version}. "
        f"Representative prompts: {prompt_text}. "
        f"Scoring config: {task_family.scoring_config.model_dump(mode='json') if hasattr(task_family.scoring_config, 'model_dump') else task_family.scoring_config}."
    ).strip()


def _rubric_text(rubric: Any) -> str:
    dimensions = "; ".join(f"{dimension.key}: {dimension.anchor}" for dimension in rubric.dimensions)
    failure_modes = "; ".join(rubric.failure_modes)
    return f"Rubric dimensions: {dimensions}. Failure modes: {failure_modes}.".strip()


@dataclass(frozen=True)
class MemorySearchResult:
    entry_id: UUID
    chunk_id: UUID
    layer: str
    text_content: str
    total_score: float
    ranking_features: dict[str, float]
    source_entity_type: str


@dataclass(frozen=True)
class AssembledMemoryContext:
    context_text: str
    memory_entry_ids: list[UUID]
    chunk_ids: list[UUID]
    ranking_features: dict[str, dict[str, float]]
    query_text: str
    token_budget: int
    assembled_context_hash: str


class MemoryProjectionService:
    def __init__(
        self,
        *,
        embedding_provider: EmbeddingProvider | None = None,
        entry_store: MutableMapping[UUID, dict[str, Any]] | None = None,
        chunk_store: MutableMapping[UUID, dict[str, Any]] | None = None,
    ) -> None:
        self._embedding_provider = embedding_provider or get_embedding_provider()
        self._entry_store = entry_store if entry_store is not None else store.memory_entries
        self._chunk_store = chunk_store if chunk_store is not None else store.memory_chunks

    def upsert_entry(self, entry: MemoryEntry) -> MemoryEntry:
        self._entry_store[entry.id] = entry.model_dump(mode="json")
        self.reindex_entry(entry.id)
        return entry

    def reindex_entry(self, entry_id: UUID) -> list[MemoryChunk]:
        payload = self._entry_store.get(entry_id)
        if payload is None:
            raise RuntimeError("memory_entry_not_found")
        entry = MemoryEntry.model_validate(payload)
        chunks = _split_chunks(entry.text_content)
        if not chunks:
            raise RuntimeError("memory_entry_text_empty")

        persisted: list[MemoryChunk] = []
        for index, chunk_text in enumerate(chunks):
            embedding = self._embedding_provider.embed(chunk_text)
            chunk = MemoryChunk(
                id=_chunk_id(entry.id, index),
                memory_entry_id=entry.id,
                tenant_id=entry.tenant_id,
                chunk_index=index,
                text_content=chunk_text,
                metadata_json={
                    "layer": entry.layer,
                    "source_entity_type": entry.source_entity_type,
                    "source_entity_id": entry.source_entity_id,
                },
                fts_document=" ".join(_normalize_tokens(chunk_text)),
                embedding=embedding,
            )
            self._chunk_store[chunk.id] = chunk.model_dump(mode="json")
            persisted.append(chunk)
        return persisted

    def project_business_context_pack(
        self,
        pack: BusinessContextPack,
        *,
        created_by: str | None,
        reviewed_by: str | None,
        change_reason: str | None,
        policy_version: str | None = None,
    ) -> MemoryEntry:
        entry = MemoryEntry(
            id=_entry_id("org", "business_context_pack", str(pack.id)),
            tenant_id=pack.tenant_id,
            layer="org",
            source_entity_type="business_context_pack",
            source_entity_id=str(pack.id),
            source_type="admin_approved",
            status=_memory_entry_status(pack.status),
            visibility_scope=_visibility_scope_for("business_context_pack"),
            created_by=created_by,
            reviewed_by=reviewed_by,
            policy_version=policy_version,
            change_reason=change_reason,
            text_content=_pack_text(pack),
            metadata_json={"pack_status": pack.status, "role_focus": pack.role_focus},
        )
        return self.upsert_entry(entry)

    def project_case_bundle(self, *, case_payload: Any, task_family: Any, rubric: Any, quality_signal: Any | None = None) -> list[MemoryEntry]:
        status = "active" if getattr(task_family, "status", "") == "published" else _memory_entry_status(str(getattr(task_family, "status", "approved")))
        entries = [
            MemoryEntry(
                id=_entry_id("content", "case_spec", str(case_payload.id)),
                tenant_id=case_payload.tenant_id,
                layer="content",
                source_entity_type="case_spec",
                source_entity_id=str(case_payload.id),
                source_type="admin_approved",
                status=status,
                visibility_scope=_visibility_scope_for("case_spec"),
                created_by="system",
                reviewed_by="system" if status in {"approved", "active"} else None,
                policy_version=None,
                change_reason="task_family_publish" if status == "active" else "case_saved",
                text_content=_case_text(case_payload),
                metadata_json={"task_family_id": str(task_family.id)},
            ),
            MemoryEntry(
                id=_entry_id("content", "task_family", str(task_family.id)),
                tenant_id=case_payload.tenant_id,
                layer="content",
                source_entity_type="task_family",
                source_entity_id=str(task_family.id),
                source_type="admin_approved",
                status=status,
                visibility_scope=_visibility_scope_for("task_family"),
                created_by="system",
                reviewed_by="system" if status in {"approved", "active"} else None,
                policy_version=None,
                change_reason="task_family_publish" if status == "active" else "task_family_saved",
                text_content=_task_family_text(task_family),
                metadata_json={"case_id": str(case_payload.id), "rubric_id": str(task_family.rubric_id)},
            ),
            MemoryEntry(
                id=_entry_id("content", "rubric", str(rubric.id)),
                tenant_id=case_payload.tenant_id,
                layer="content",
                source_entity_type="rubric",
                source_entity_id=str(rubric.id),
                source_type="admin_approved",
                status=status,
                visibility_scope=_visibility_scope_for("rubric"),
                created_by="system",
                reviewed_by="system" if status in {"approved", "active"} else None,
                policy_version=None,
                change_reason="task_family_publish" if status == "active" else "rubric_saved",
                text_content=_rubric_text(rubric),
                metadata_json={"case_id": str(case_payload.id), "task_family_id": str(task_family.id)},
            ),
        ]
        if quality_signal is not None:
            entries.append(
                MemoryEntry(
                    id=_entry_id("content", "task_quality_signal", str(quality_signal.task_family_id)),
                    tenant_id=case_payload.tenant_id,
                    layer="content",
                    source_entity_type="task_quality_signal",
                    source_entity_id=str(quality_signal.task_family_id),
                    source_type="model_inferred",
                    status=status,
                    visibility_scope=_visibility_scope_for("task_quality_signal"),
                    created_by="system",
                    reviewed_by=None,
                    policy_version=None,
                    change_reason="quality_evaluated",
                    text_content=(
                        f"Quality score {quality_signal.quality_score}. "
                        f"Diversity {quality_signal.diversity_score}. "
                        f"Realism {quality_signal.realism_score}. "
                        f"Leakage detected {quality_signal.rubric_leakage_detected}."
                    ),
                    metadata_json={"task_family_id": str(quality_signal.task_family_id)},
                )
            )
        return [self.upsert_entry(entry) for entry in entries]

    def project_session_digest(self, digest: SessionMemoryDigest) -> MemoryEntry:
        entry = MemoryEntry(
            id=_entry_id("episode", "session_digest", str(digest.session_id)),
            tenant_id=digest.tenant_id,
            layer="episode",
            source_entity_type="session_digest",
            source_entity_id=str(digest.session_id),
            source_type="model_inferred",
            status="active",
            visibility_scope=_visibility_scope_for("session_digest"),
            created_by="system",
            reviewed_by=None,
            policy_version=None,
            change_reason="session_digest_refresh",
            text_content=digest.summary_text,
            metadata_json={
                "session_id": str(digest.session_id),
                "facts_json": digest.facts_json,
                "risk_signals": digest.risk_signals,
                "open_questions": digest.open_questions,
                "last_event_offset": digest.last_event_offset,
            },
        )
        return self.upsert_entry(entry)

    def project_human_review(self, review: HumanReviewRecord) -> MemoryEntry:
        text_parts = [review.notes_markdown or ""]
        if review.tags:
            text_parts.append(f"Tags: {', '.join(review.tags)}")
        if review.dimension_overrides:
            text_parts.append(f"Dimension overrides: {review.dimension_overrides}")
        entry = MemoryEntry(
            id=_entry_id("episode", "human_review", str(review.session_id)),
            tenant_id=review.tenant_id,
            layer="episode",
            source_entity_type="human_review",
            source_entity_id=str(review.session_id),
            source_type="admin_approved",
            status="active",
            visibility_scope=_visibility_scope_for("human_review"),
            created_by=review.reviewer_id,
            reviewed_by=review.reviewer_id,
            policy_version=None,
            change_reason="human_review_updated",
            text_content=" ".join(part for part in text_parts if part).strip() or "Human review recorded.",
            metadata_json={"session_id": str(review.session_id)},
        )
        return self.upsert_entry(entry)

    def project_interpretation_view(self, view: InterpretationView, *, tenant_id: str) -> MemoryEntry:
        entry = MemoryEntry(
            id=_entry_id("episode", "interpretation_view", str(view.view_id)),
            tenant_id=tenant_id,
            layer="episode",
            source_entity_type="interpretation_view",
            source_entity_id=str(view.view_id),
            source_type="model_inferred",
            status="active",
            visibility_scope=_visibility_scope_for("interpretation_view"),
            created_by="system",
            reviewed_by=None,
            policy_version=None,
            change_reason="interpretation_generated",
            text_content=f"Interpretation view for session {view.session_id}: {view.breakdown}",
            metadata_json={"session_id": str(view.session_id), "view_id": str(view.view_id)},
        )
        return self.upsert_entry(entry)

    def reindex_tenant(self, tenant_id: str) -> int:
        count = 0
        for payload in self._entry_store.values():
            entry = MemoryEntry.model_validate(payload)
            if entry.tenant_id != tenant_id:
                continue
            self.reindex_entry(entry.id)
            count += 1
        return count


class MemoryRetrievalService:
    def __init__(
        self,
        *,
        embedding_provider: EmbeddingProvider | None = None,
        entry_store: MutableMapping[UUID, dict[str, Any]] | None = None,
        chunk_store: MutableMapping[UUID, dict[str, Any]] | None = None,
    ) -> None:
        self._embedding_provider = embedding_provider or get_embedding_provider()
        self._entry_store = entry_store if entry_store is not None else store.memory_entries
        self._chunk_store = chunk_store if chunk_store is not None else store.memory_chunks

    def retrieve(
        self,
        *,
        tenant_id: str,
        actor_role: str,
        consumer: str,
        query_text: str,
        token_budget: int,
        max_chunks: int,
        session_id: UUID | None = None,
    ) -> list[MemorySearchResult]:
        policy = _consumer_policy(consumer)
        allowed_layers = set(policy["layers"])
        allowed_sources = set(policy["allowed_sources"])
        entries = [
            MemoryEntry.model_validate(payload)
            for payload in self._entry_store.values()
            if payload.get("tenant_id") == tenant_id
        ]
        filtered_entries: list[MemoryEntry] = []
        for entry in entries:
            if entry.status != "active":
                continue
            if entry.layer not in allowed_layers:
                continue
            if actor_role not in entry.visibility_scope:
                continue
            if entry.source_entity_type not in allowed_sources:
                continue
            if entry.layer == "episode" and session_id is not None:
                if entry.metadata_json.get("session_id") != str(session_id) and entry.source_entity_id != str(session_id):
                    continue
            filtered_entries.append(entry)

        if not filtered_entries:
            return []

        chunks = [
            MemoryChunk.model_validate(payload)
            for payload in self._chunk_store.values()
            if payload.get("tenant_id") == tenant_id
        ]
        by_entry: dict[UUID, list[MemoryChunk]] = {}
        for chunk in chunks:
            by_entry.setdefault(chunk.memory_entry_id, []).append(chunk)

        filtered_entry_ids = {entry.id for entry in filtered_entries}
        if not any(entry_id in by_entry for entry_id in filtered_entry_ids):
            raise RuntimeError("memory_chunk_index_missing")

        for entry in filtered_entries:
            if entry.id not in by_entry:
                continue
            newest_chunk = max(by_entry[entry.id], key=_chunk_updated_at)
            if _chunk_updated_at(newest_chunk) < _entry_updated_at(entry):
                raise RuntimeError("memory_chunk_index_stale")

        query_embedding = self._embedding_provider.embed(query_text)
        ranked: list[MemorySearchResult] = []
        token_count = 0

        for entry in filtered_entries:
            for chunk in by_entry.get(entry.id, []):
                fts_score = _fts_score(query_text, chunk.fts_document or chunk.text_content)
                vector_score = _cosine_similarity(query_embedding, chunk.embedding)
                recency_boost = _recency_boost(_entry_updated_at(entry))
                review_weight = _review_weight(entry)
                total_score = round(fts_score + vector_score + recency_boost + review_weight, 6)
                ranked.append(
                    MemorySearchResult(
                        entry_id=entry.id,
                        chunk_id=chunk.id,
                        layer=entry.layer,
                        text_content=chunk.text_content,
                        total_score=total_score,
                        ranking_features={
                            "fts_score": fts_score,
                            "vector_score": vector_score,
                            "recency_boost": recency_boost,
                            "review_weight": review_weight,
                            "total_score": total_score,
                        },
                        source_entity_type=entry.source_entity_type,
                    )
                )

        ranked.sort(key=lambda item: (item.total_score, item.layer == "episode"), reverse=True)

        results: list[MemorySearchResult] = []
        for item in ranked:
            item_tokens = len(item.text_content.split())
            if results and len(results) >= max_chunks:
                break
            if results and token_count + item_tokens > token_budget:
                break
            results.append(item)
            token_count += item_tokens
        return results


class MemoryAssembler:
    def __init__(self, *, retrieval_service: MemoryRetrievalService | None = None) -> None:
        self._retrieval_service = retrieval_service or MemoryRetrievalService()

    def assemble(self, request: MemoryAssemblerRequest) -> AssembledMemoryContext:
        policy = _consumer_policy(request.consumer)
        max_chunks = request.max_chunks_override or int(policy["max_chunks"])
        token_budget = request.token_budget_override or int(policy["token_budget"])
        results = self._retrieval_service.retrieve(
            tenant_id=request.tenant_id,
            actor_role=request.actor_role,
            consumer=request.consumer,
            query_text=request.query_text,
            token_budget=token_budget,
            max_chunks=max_chunks,
            session_id=request.session_id,
        )

        grouped: dict[str, list[MemorySearchResult]] = {layer: [] for layer in policy["layers"]}
        for result in results:
            grouped.setdefault(result.layer, []).append(result)

        lines: list[str] = []
        memory_entry_ids: list[UUID] = []
        chunk_ids: list[UUID] = []
        ranking_features: dict[str, dict[str, float]] = {}
        seen_entries: set[UUID] = set()

        for layer in policy["layers"]:
            for result in grouped.get(layer, []):
                lines.append(f"Layer: {layer}")
                lines.append(f"Source: {result.source_entity_type}")
                lines.append(result.text_content)
                if result.entry_id not in seen_entries:
                    memory_entry_ids.append(result.entry_id)
                    seen_entries.add(result.entry_id)
                chunk_ids.append(result.chunk_id)
                ranking_features[str(result.chunk_id)] = result.ranking_features

        context_text = "\n".join(lines).strip()
        assembled_context_hash = hashlib.sha256(context_text.encode("utf-8")).hexdigest()
        return AssembledMemoryContext(
            context_text=context_text,
            memory_entry_ids=memory_entry_ids,
            chunk_ids=chunk_ids,
            ranking_features=ranking_features,
            query_text=request.query_text,
            token_budget=token_budget,
            assembled_context_hash=assembled_context_hash,
        )


class SessionDigestService:
    def __init__(self, *, projection_service: MemoryProjectionService | None = None) -> None:
        self._projection_service = projection_service or MemoryProjectionService()

    def refresh(self, session_id: UUID, *, tenant_id: str, force: bool = False) -> SessionMemoryDigest:
        events = session_repository.list_events(session_id)
        existing = store.session_memory_digests.get(session_id)
        if existing is not None:
            current = SessionMemoryDigest.model_validate(existing)
            if not force and len(events) - int(current.last_event_offset) < 10:
                return current

        event_counts = Counter(str(event.get("event_type", "")) for event in events)
        coach_feedback = [
            payload
            for payload in store.coach_feedback.values()
            if str(payload.get("session_id")) == str(session_id)
        ]
        feedback_tags = sorted(
            {
                str(tag)
                for payload in coach_feedback
                for tag in payload.get("confusion_tags", [])
            }
        )
        score = scoring_repository.get_score(session_id)
        trigger_codes = list(score.trigger_codes) if score is not None else []

        summary_parts = [
            f"Session has {len(events)} events.",
            f"Event types: {dict(event_counts)}.",
        ]
        if feedback_tags:
            summary_parts.append(f"Coach feedback tags: {', '.join(feedback_tags)}.")
        if trigger_codes:
            summary_parts.append(f"Score trigger codes: {', '.join(trigger_codes)}.")
        summary_text = " ".join(summary_parts).strip()

        risk_signals = sorted(
            {
                event_type
                for event_type, count in event_counts.items()
                if count > 0 and ("violation" in event_type or "error" in event_type)
            }
        )
        risk_signals.extend(code for code in trigger_codes if code not in risk_signals)

        open_questions = list(feedback_tags)
        if "verification_step_completed" not in event_counts:
            open_questions.append("verification")
        open_questions = sorted(set(open_questions))

        digest = SessionMemoryDigest(
            session_id=session_id,
            tenant_id=tenant_id,
            summary_text=summary_text,
            facts_json={
                "event_count": len(events),
                "event_type_counts": dict(event_counts),
                "coach_feedback_count": len(coach_feedback),
                "trigger_codes": trigger_codes,
            },
            risk_signals=risk_signals,
            open_questions=open_questions,
            last_event_offset=len(events),
        )
        store.session_memory_digests[session_id] = digest.model_dump(mode="json")
        self._projection_service.project_session_digest(digest)
        return digest


memory_projection_service = MemoryProjectionService()
memory_retrieval_service = MemoryRetrievalService()
memory_assembler = MemoryAssembler(retrieval_service=memory_retrieval_service)
session_digest_service = SessionDigestService(projection_service=memory_projection_service)


def sync_business_context_pack_memory(
    pack: BusinessContextPack,
    *,
    created_by: str | None,
    reviewed_by: str | None,
    change_reason: str | None,
    policy_version: str | None = None,
) -> MemoryEntry:
    return memory_projection_service.project_business_context_pack(
        pack,
        created_by=created_by,
        reviewed_by=reviewed_by,
        change_reason=change_reason,
        policy_version=policy_version,
    )


def sync_task_family_memory(task_family_id: UUID) -> list[MemoryEntry]:
    task_family = case_repository.get_task_family(task_family_id)
    if task_family is None:
        raise RuntimeError("task_family_not_found")
    case_payload = case_repository.get_case(task_family.case_id)
    if case_payload is None:
        raise RuntimeError("case_not_found")
    rubric = case_repository.get_rubric(task_family.rubric_id)
    if rubric is None:
        raise RuntimeError("rubric_not_found")
    quality_signal = store.task_quality_signals.get(task_family_id)
    validated_quality_signal = (
        TaskQualitySignal.model_validate(quality_signal)
        if isinstance(quality_signal, dict)
        else None
    )
    return memory_projection_service.project_case_bundle(
        case_payload=case_payload,
        task_family=task_family,
        rubric=rubric,
        quality_signal=validated_quality_signal,
    )


def sync_human_review_memory(review: HumanReviewRecord) -> MemoryEntry:
    return memory_projection_service.project_human_review(review)


def sync_interpretation_view_memory(view: InterpretationView, *, tenant_id: str) -> MemoryEntry:
    return memory_projection_service.project_interpretation_view(view, tenant_id=tenant_id)
