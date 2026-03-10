from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from uuid import UUID

from app.providers.embedding_provider import HashEmbeddingProvider
from app.schemas import MemoryAssemblerRequest, MemoryEntry
from app.services.memory import MemoryAssembler, MemoryProjectionService, MemoryRetrievalService


def _normalized_uuid_set(raw: Any) -> set[UUID]:
    if not isinstance(raw, list):
        return set()
    values: set[UUID] = set()
    for item in raw:
        try:
            values.add(UUID(str(item)))
        except (TypeError, ValueError):
            continue
    return values


def _ordered_unique_entry_ids(results: list[Any]) -> list[UUID]:
    ordered: list[UUID] = []
    seen: set[UUID] = set()
    for result in results:
        if result.entry_id in seen:
            continue
        ordered.append(result.entry_id)
        seen.add(result.entry_id)
    return ordered


def _phrase_hits(text: str, phrases: list[str]) -> list[str]:
    lower = text.lower()
    return [phrase for phrase in phrases if phrase.lower() in lower]


def _layer_sequence_ok(text: str, expected_layers: list[str]) -> bool:
    if not expected_layers:
        return True
    positions: list[int] = []
    for label in expected_layers:
        index = text.find(label)
        if index < 0:
            return False
        positions.append(index)
    return positions == sorted(positions)


def _safe_ratio(numerator: int, denominator: int, *, empty_default: float) -> float:
    if denominator == 0:
        return empty_default
    return round(numerator / denominator, 6)


def _run_case(case_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    entry_store: dict[UUID, dict[str, Any]] = {}
    chunk_store: dict[UUID, dict[str, Any]] = {}
    provider = HashEmbeddingProvider()
    projection = MemoryProjectionService(
        embedding_provider=provider,
        entry_store=entry_store,
        chunk_store=chunk_store,
    )
    retrieval = MemoryRetrievalService(
        embedding_provider=provider,
        entry_store=entry_store,
        chunk_store=chunk_store,
    )
    assembler = MemoryAssembler(retrieval_service=retrieval)

    for raw_entry in payload.get("memory_entries", []):
        entry = MemoryEntry.model_validate(raw_entry)
        projection.upsert_entry(entry)

    session_id = payload.get("session_id")
    resolved_session_id = UUID(str(session_id)) if session_id else None
    token_budget = int(payload.get("token_budget", 1000))
    max_chunks = int(payload.get("max_chunks", 5))
    query_text = str(payload.get("query_text", ""))
    consumer = str(payload.get("consumer", "coach"))
    actor_role = str(payload.get("actor_role", "candidate"))
    tenant_id = str(payload.get("tenant_id", "tenant_a"))

    results = retrieval.retrieve(
        tenant_id=tenant_id,
        actor_role=actor_role,
        consumer=consumer,
        query_text=query_text,
        token_budget=token_budget,
        max_chunks=max_chunks,
        session_id=resolved_session_id,
    )
    assembled = assembler.assemble(
        MemoryAssemblerRequest(
            tenant_id=tenant_id,
            actor_role=actor_role,
            consumer=consumer,
            query_text=query_text,
            session_id=resolved_session_id,
            token_budget_override=token_budget,
            max_chunks_override=max_chunks,
        )
    )

    ordered_entry_ids = _ordered_unique_entry_ids(results)
    retrieved_entry_ids = {entry_id for entry_id in ordered_entry_ids}
    expected_entry_ids = _normalized_uuid_set(payload.get("expected_retrieved_entry_ids", []))
    forbidden_entry_ids = _normalized_uuid_set(payload.get("forbidden_entry_ids", []))
    true_positives = len(retrieved_entry_ids & expected_entry_ids)
    retrieval_precision = _safe_ratio(true_positives, len(retrieved_entry_ids), empty_default=1.0)
    retrieval_recall = _safe_ratio(true_positives, len(expected_entry_ids), empty_default=1.0)

    reciprocal_rank = 0.0
    for index, entry_id in enumerate(ordered_entry_ids, start=1):
        if entry_id in expected_entry_ids:
            reciprocal_rank = round(1.0 / index, 6)
            break

    forbidden_retrieved_ids = sorted(str(entry_id) for entry_id in (retrieved_entry_ids & forbidden_entry_ids))
    expected_grounding_phrases = [str(item) for item in payload.get("expected_grounding_phrases", [])]
    forbidden_grounding_phrases = [str(item) for item in payload.get("forbidden_grounding_phrases", [])]
    grounding_hits = _phrase_hits(assembled.context_text, expected_grounding_phrases)
    forbidden_grounding_hits = _phrase_hits(assembled.context_text, forbidden_grounding_phrases)
    grounding_coverage = _safe_ratio(len(grounding_hits), len(expected_grounding_phrases), empty_default=1.0)
    expected_layers = [str(item) for item in payload.get("expected_layer_sequence", [])]
    layer_sequence_ok = _layer_sequence_ok(assembled.context_text, expected_layers)

    return {
        "case_id": case_id,
        "retrieved_entry_ids": [str(entry_id) for entry_id in ordered_entry_ids],
        "expected_entry_ids": [str(entry_id) for entry_id in sorted(expected_entry_ids)],
        "retrieval_precision": retrieval_precision,
        "retrieval_recall": retrieval_recall,
        "reciprocal_rank": reciprocal_rank,
        "forbidden_retrieved_ids": forbidden_retrieved_ids,
        "grounding_hits": grounding_hits,
        "grounding_coverage": grounding_coverage,
        "forbidden_grounding_hits": forbidden_grounding_hits,
        "layer_sequence_ok": layer_sequence_ok,
        "assembled_context_hash": assembled.assembled_context_hash,
    }


def evaluate_memory_benchmark(case_results: list[dict[str, Any]], *, thresholds: dict[str, Any]) -> dict[str, Any]:
    checked_cases = len(case_results)
    retrieval_precision_avg = _safe_ratio(
        int(round(sum(float(item["retrieval_precision"]) for item in case_results) * 1_000_000)),
        checked_cases * 1_000_000,
        empty_default=1.0,
    )
    retrieval_recall_avg = _safe_ratio(
        int(round(sum(float(item["retrieval_recall"]) for item in case_results) * 1_000_000)),
        checked_cases * 1_000_000,
        empty_default=1.0,
    )
    grounding_coverage_avg = _safe_ratio(
        int(round(sum(float(item["grounding_coverage"]) for item in case_results) * 1_000_000)),
        checked_cases * 1_000_000,
        empty_default=1.0,
    )

    retrieval_precision_min = float(thresholds.get("retrieval_precision_min", 0.8))
    retrieval_recall_min = float(thresholds.get("retrieval_recall_min", 0.8))
    reciprocal_rank_min = float(thresholds.get("reciprocal_rank_min", 0.5))
    grounding_coverage_min = float(thresholds.get("grounding_coverage_min", 0.8))
    forbidden_hits_max = int(thresholds.get("forbidden_hits_max", 0))

    regressions: list[dict[str, Any]] = []
    retrieval_regression_count = 0
    grounding_leakage_count = 0
    grounding_regression_count = 0

    for item in case_results:
        retrieval_failed = (
            float(item["retrieval_precision"]) < retrieval_precision_min
            or float(item["retrieval_recall"]) < retrieval_recall_min
            or float(item["reciprocal_rank"]) < reciprocal_rank_min
            or bool(item["forbidden_retrieved_ids"])
        )
        if retrieval_failed:
            retrieval_regression_count += 1
            regressions.append(
                {
                    "case_id": item["case_id"],
                    "reason": "retrieval_regression",
                    "retrieval_precision": item["retrieval_precision"],
                    "retrieval_recall": item["retrieval_recall"],
                    "reciprocal_rank": item["reciprocal_rank"],
                    "forbidden_retrieved_ids": item["forbidden_retrieved_ids"],
                }
            )

        if len(item["forbidden_grounding_hits"]) > forbidden_hits_max:
            grounding_leakage_count += 1
            regressions.append(
                {
                    "case_id": item["case_id"],
                    "reason": "grounding_leakage",
                    "forbidden_grounding_hits": item["forbidden_grounding_hits"],
                }
            )

        if float(item["grounding_coverage"]) < grounding_coverage_min or not bool(item["layer_sequence_ok"]):
            grounding_regression_count += 1
            regressions.append(
                {
                    "case_id": item["case_id"],
                    "reason": "grounding_regression",
                    "grounding_coverage": item["grounding_coverage"],
                    "layer_sequence_ok": item["layer_sequence_ok"],
                }
            )

    return {
        "pass": len(regressions) == 0,
        "checked_cases": checked_cases,
        "retrieval_precision_avg": retrieval_precision_avg,
        "retrieval_recall_avg": retrieval_recall_avg,
        "grounding_coverage_avg": grounding_coverage_avg,
        "retrieval_regression_count": retrieval_regression_count,
        "grounding_regression_count": grounding_regression_count,
        "grounding_leakage_count": grounding_leakage_count,
        "cases": case_results,
        "regressions": regressions,
    }


def run_memory_benchmark_fixture(path: str | Path) -> dict[str, Any]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    thresholds = payload.get("thresholds", {})
    cases = payload.get("cases", {})

    case_results = [_run_case(str(case_id), dict(case_payload)) for case_id, case_payload in cases.items()]
    return evaluate_memory_benchmark(case_results, thresholds=thresholds)
