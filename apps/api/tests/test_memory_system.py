from uuid import UUID, uuid4

import pytest

from app.providers.embedding_provider import HashEmbeddingProvider
from app.schemas import MemoryAssemblerRequest, MemoryChunk, MemoryEntry, SessionMemoryDigest
from app.services.jobs import process_jobs_until_empty
from app.services.memory import MemoryAssembler, MemoryProjectionService, MemoryRetrievalService
from app.services.repositories import case_repository, session_repository
from app.services.store import store


def _job_result(client, job_id, headers):
    process_jobs_until_empty()
    response = client.get(f"/v1/jobs/{job_id}/result", headers=headers)
    assert response.status_code == 200
    return response.json()["result"]


def _create_active_pack(client, admin_headers):
    pack = client.post(
        "/v1/business-context/packs",
        headers=admin_headers,
        json={
            "name": "Growth Ops Pack",
            "role_focus": "growth_analyst",
            "job_description": "Northstar context blueprint for growth investigations.",
            "examples": ["Prioritize retention diagnosis before channel expansion."],
            "constraints": {"policy": "Escalate material data gaps before recommending spend."},
        },
    )
    assert pack.status_code == 201
    pack_id = pack.json()["id"]

    reviewed = client.post(
        f"/v1/business-context/packs/{pack_id}/review",
        headers=admin_headers,
        json={"review_note": "approved for activation"},
    )
    assert reviewed.status_code == 200

    activated = client.post(
        f"/v1/business-context/packs/{pack_id}/activate",
        headers=admin_headers,
        json={"change_reason": "use in production"},
    )
    assert activated.status_code == 200
    return pack_id


def _create_published_task_family(client, admin_headers, reviewer_headers):
    case_res = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "Memory Integration Case",
            "scenario": "Investigate conversion drop and propose mitigations.",
            "artifacts": [{"type": "query_log", "name": "query_history.csv"}],
            "metrics": [],
            "allowed_tools": ["sql_workspace", "dashboard_workspace", "copilot"],
        },
    )
    assert case_res.status_code == 201
    case_id = case_res.json()["id"]

    generate = client.post(
        f"/v1/cases/{case_id}/generate",
        headers={**admin_headers, "Idempotency-Key": "memory-generate-1"},
    )
    assert generate.status_code == 202
    generated = _job_result(client, generate.json()["job_id"], admin_headers)
    task_family_id = generated["task_family"]["id"]

    review = client.post(
        f"/v1/task-families/{task_family_id}/review",
        headers=reviewer_headers,
        json={"decision": "approve", "review_note": "quality approved"},
    )
    assert review.status_code == 200
    publish = client.post(
        f"/v1/task-families/{task_family_id}/publish",
        headers=reviewer_headers,
        json={"approver_note": "publish"},
    )
    assert publish.status_code == 200
    return case_id, task_family_id


def _create_submitted_session(client, admin_headers, reviewer_headers, candidate_headers):
    _, task_family_id = _create_published_task_family(client, admin_headers, reviewer_headers)
    session = client.post(
        "/v1/sessions",
        headers=reviewer_headers,
        json={
            "task_family_id": task_family_id,
            "candidate_id": "candidate_1",
            "policy": {"raw_content_opt_in": True, "retention_ttl_days": 30},
        },
    )
    assert session.status_code == 201
    session_id = session.json()["id"]
    return session_id, task_family_id


def test_business_context_pack_lifecycle_projects_memory_entries(client, admin_headers):
    pack_id = _create_active_pack(client, admin_headers)

    proposed_entries = client.get("/v1/memory/entries?layer=org", headers=admin_headers)
    assert proposed_entries.status_code == 200
    items = proposed_entries.json()["items"]
    assert any(item["source_entity_id"] == pack_id for item in items)

    active_entries = client.get("/v1/memory/entries?layer=org&status=active", headers=admin_headers)
    assert active_entries.status_code == 200
    active_item = next(item for item in active_entries.json()["items"] if item["source_entity_id"] == pack_id)
    assert active_item["layer"] == "org"
    assert active_item["status"] == "active"
    assert active_item["source_entity_type"] == "business_context_pack"


def test_session_digest_refresh_and_context_trace_enrichment(client, admin_headers, reviewer_headers, candidate_headers):
    _create_active_pack(client, admin_headers)
    session_id, _task_family_id = _create_submitted_session(client, admin_headers, reviewer_headers, candidate_headers)

    ingest = client.post(
        f"/v1/sessions/{session_id}/events",
        headers=candidate_headers,
        json={
            "events": [
                {"event_type": f"verification_step_completed", "payload": {"step": index}}
                for index in range(10)
            ]
        },
    )
    assert ingest.status_code == 202

    digest_resp = client.get(f"/v1/memory/session-digests/{session_id}", headers=reviewer_headers)
    assert digest_resp.status_code == 200
    digest = digest_resp.json()
    assert digest["session_id"] == session_id
    assert digest["last_event_offset"] == 10
    assert "verification_step_completed" in digest["summary_text"]

    mode = client.post(
        f"/v1/sessions/{session_id}/mode",
        headers=reviewer_headers,
        json={"mode": "practice"},
    )
    assert mode.status_code == 200

    coach = client.post(
        f"/v1/sessions/{session_id}/coach/message",
        headers=candidate_headers,
        json={"message": "What should I verify before escalating the anomaly?"},
    )
    assert coach.status_code == 200

    feedback = client.post(
        f"/v1/sessions/{session_id}/coach/feedback",
        headers=candidate_headers,
        json={"helpful": True, "confusion_tags": ["verification"], "notes": "Need sharper business framing."},
    )
    assert feedback.status_code == 201

    digest_after = client.get(f"/v1/memory/session-digests/{session_id}", headers=reviewer_headers)
    assert digest_after.status_code == 200
    assert "verification" in digest_after.json()["summary_text"].lower()

    traces = client.get(f"/v1/context/injection-traces/{session_id}", headers=reviewer_headers)
    assert traces.status_code == 200
    latest = traces.json()["items"][-1]
    assert latest["memory_entry_ids"]
    assert latest["chunk_ids"]
    assert latest["query_text"]
    assert latest["token_budget"] == 1500
    assert latest["assembled_context_hash"]
    assert latest["ranking_features"]


def test_generation_and_scoring_use_memory_platform(client, admin_headers, reviewer_headers, candidate_headers):
    _create_active_pack(client, admin_headers)
    case_id, task_family_id = _create_published_task_family(client, admin_headers, reviewer_headers)

    generated_task_family = case_repository.get_task_family(UUID(task_family_id))
    assert generated_task_family is not None
    assert generated_task_family.generation_diagnostics["memory_entry_ids"]
    assert generated_task_family.generation_diagnostics["memory_context_hash"]

    session = client.post(
        "/v1/sessions",
        headers=reviewer_headers,
        json={
            "task_family_id": task_family_id,
            "candidate_id": "candidate_1",
            "policy": {"raw_content_opt_in": True, "retention_ttl_days": 30},
        },
    )
    assert session.status_code == 201
    session_id = session.json()["id"]

    ingest = client.post(
        f"/v1/sessions/{session_id}/events",
        headers=candidate_headers,
        json={"events": [{"event_type": "copilot_invoked", "payload": {"time_to_first_action_ms": 1200}}]},
    )
    assert ingest.status_code == 202

    submit = client.post(
        f"/v1/sessions/{session_id}/submit",
        headers=candidate_headers,
        json={"final_response": "Escalate after validating source-versus-dashboard divergence."},
    )
    assert submit.status_code == 200

    score = client.post(
        f"/v1/sessions/{session_id}/score",
        headers={**reviewer_headers, "Idempotency-Key": "memory-score-1"},
    )
    assert score.status_code == 202
    _job_result(client, score.json()["job_id"], reviewer_headers)

    traces = client.get(f"/v1/context/injection-traces/{session_id}", headers=reviewer_headers)
    assert traces.status_code == 200
    evaluator_trace = next(item for item in traces.json()["items"] if item["agent_type"] == "evaluator")
    assert evaluator_trace["token_budget"] == 4000
    assert evaluator_trace["memory_entry_ids"]

    report = client.get(f"/v1/reports/{session_id}", headers=reviewer_headers)
    assert report.status_code == 200
    assert report.json()["score_result"]["llm_traces"] is not None

    case_payload = client.get(f"/v1/cases/{case_id}", headers=reviewer_headers)
    assert case_payload.status_code == 200


def test_memory_retrieval_filters_and_ranking(client):
    entry_one = MemoryEntry(
        tenant_id="tenant_a",
        layer="content",
        source_entity_type="task_family",
        source_entity_id=str(uuid4()),
        source_type="admin_approved",
        status="active",
        visibility_scope=["candidate", "reviewer", "org_admin"],
        created_by="reviewer_1",
        reviewed_by="reviewer_1",
        policy_version="1.0.0",
        change_reason="publish",
        text_content="Northstar anomaly escalation playbook with retention-first verification.",
        metadata_json={"kind": "playbook"},
    )
    entry_two = MemoryEntry(
        tenant_id="tenant_a",
        layer="episode",
        source_entity_type="human_review",
        source_entity_id=str(uuid4()),
        source_type="admin_approved",
        status="active",
        visibility_scope=["reviewer", "org_admin"],
        created_by="reviewer_1",
        reviewed_by="reviewer_1",
        policy_version="1.0.0",
        change_reason="review",
        text_content="Reviewer note: escalation lacked retention-first verification evidence.",
        metadata_json={"kind": "review"},
    )
    entry_three = MemoryEntry(
        tenant_id="tenant_b",
        layer="content",
        source_entity_type="task_family",
        source_entity_id=str(uuid4()),
        source_type="admin_approved",
        status="active",
        visibility_scope=["candidate", "reviewer", "org_admin"],
        created_by="reviewer_2",
        reviewed_by="reviewer_2",
        policy_version="1.0.0",
        change_reason="publish",
        text_content="Different tenant memory that must never leak.",
        metadata_json={"kind": "playbook"},
    )
    store.memory_entries[entry_one.id] = entry_one.model_dump(mode="json")
    store.memory_entries[entry_two.id] = entry_two.model_dump(mode="json")
    store.memory_entries[entry_three.id] = entry_three.model_dump(mode="json")

    provider = HashEmbeddingProvider()
    projection = MemoryProjectionService(embedding_provider=provider)
    projection.reindex_entry(entry_one.id)
    projection.reindex_entry(entry_two.id)
    projection.reindex_entry(entry_three.id)

    retrieval = MemoryRetrievalService(embedding_provider=provider)
    reviewer_results = retrieval.retrieve(
        tenant_id="tenant_a",
        actor_role="reviewer",
        consumer="evaluator",
        query_text="retention verification before escalation",
        token_budget=1000,
        max_chunks=5,
    )
    assert [result.entry_id for result in reviewer_results][:2] == [entry_two.id, entry_one.id]

    candidate_results = retrieval.retrieve(
        tenant_id="tenant_a",
        actor_role="candidate",
        consumer="coach",
        query_text="retention verification before escalation",
        token_budget=1000,
        max_chunks=5,
    )
    assert entry_two.id not in [result.entry_id for result in candidate_results]
    assert entry_three.id not in [result.entry_id for result in candidate_results]


def test_memory_services_fail_when_embedding_or_chunks_missing(client):
    entry = MemoryEntry(
        tenant_id="tenant_a",
        layer="org",
        source_entity_type="business_context_pack",
        source_entity_id=str(uuid4()),
        source_type="admin_approved",
        status="active",
        visibility_scope=["candidate", "reviewer", "org_admin"],
        created_by="admin_1",
        reviewed_by="admin_1",
        policy_version="1.0.0",
        change_reason="activate",
        text_content="Escalate data quality gaps before recommendation.",
        metadata_json={},
    )
    store.memory_entries[entry.id] = entry.model_dump(mode="json")

    retrieval = MemoryRetrievalService(embedding_provider=HashEmbeddingProvider())
    with pytest.raises(RuntimeError, match="memory_chunk_index_missing"):
        retrieval.retrieve(
            tenant_id="tenant_a",
            actor_role="candidate",
            consumer="coach",
            query_text="data quality gaps",
            token_budget=1000,
            max_chunks=5,
        )

    class MissingEmbeddingProvider:
        def embed(self, _text: str) -> list[float]:
            raise RuntimeError("embedding_provider_unavailable")

    projection = MemoryProjectionService(embedding_provider=MissingEmbeddingProvider())
    with pytest.raises(RuntimeError, match="embedding_provider_unavailable"):
        projection.reindex_entry(entry.id)


def test_memory_assembler_uses_layer_order(client):
    org_entry = MemoryEntry(
        tenant_id="tenant_a",
        layer="org",
        source_entity_type="business_context_pack",
        source_entity_id=str(uuid4()),
        source_type="admin_approved",
        status="active",
        visibility_scope=["candidate", "reviewer", "org_admin"],
        created_by="admin_1",
        reviewed_by="admin_1",
        policy_version="1.0.0",
        change_reason="activate",
        text_content="Org policy: verify retention impact before spend recommendation.",
        metadata_json={},
    )
    content_entry = MemoryEntry(
        tenant_id="tenant_a",
        layer="content",
        source_entity_type="task_family",
        source_entity_id=str(uuid4()),
        source_type="admin_approved",
        status="active",
        visibility_scope=["candidate", "reviewer", "org_admin"],
        created_by="reviewer_1",
        reviewed_by="reviewer_1",
        policy_version="1.0.0",
        change_reason="publish",
        text_content="Task exemplar: explain source-versus-dashboard discrepancy with caveats.",
        metadata_json={},
    )
    digest = SessionMemoryDigest(
        session_id=uuid4(),
        tenant_id="tenant_a",
        summary_text="Episode summary: learner already checked instrumentation drift.",
        facts_json={"event_count": 12},
        risk_signals=["none"],
        open_questions=["quantify impact"],
        last_event_offset=12,
    )
    episode_entry = MemoryEntry(
        tenant_id="tenant_a",
        layer="episode",
        source_entity_type="session_digest",
        source_entity_id=str(digest.session_id),
        source_type="model_inferred",
        status="active",
        visibility_scope=["candidate", "reviewer", "org_admin"],
        created_by="system",
        reviewed_by=None,
        policy_version=None,
        change_reason="digest_refresh",
        text_content=digest.summary_text,
        metadata_json=digest.facts_json,
    )
    store.memory_entries[org_entry.id] = org_entry.model_dump(mode="json")
    store.memory_entries[content_entry.id] = content_entry.model_dump(mode="json")
    store.memory_entries[episode_entry.id] = episode_entry.model_dump(mode="json")
    store.session_memory_digests[digest.session_id] = digest.model_dump(mode="json")

    provider = HashEmbeddingProvider()
    projection = MemoryProjectionService(embedding_provider=provider)
    projection.reindex_entry(org_entry.id)
    projection.reindex_entry(content_entry.id)
    projection.reindex_entry(episode_entry.id)

    assembler = MemoryAssembler(retrieval_service=MemoryRetrievalService(embedding_provider=provider))
    assembled = assembler.assemble(
        MemoryAssemblerRequest(
            tenant_id="tenant_a",
            actor_role="candidate",
            consumer="coach",
            query_text="How do I verify the retention issue before escalating?",
            session_id=digest.session_id,
        )
    )
    assert assembled.memory_entry_ids
    assert assembled.token_budget == 1500
    assert "Layer: org" in assembled.context_text
    assert assembled.context_text.index("Layer: org") < assembled.context_text.index("Layer: content")
    assert assembled.context_text.index("Layer: content") < assembled.context_text.index("Layer: episode")
