from uuid import uuid4

from app.schemas import (
    BusinessContextPack,
    CaseSpec,
    Interpretation,
    Report,
    ReviewQueueItem,
    ScoreResult,
    Session,
    TaskFamily,
)
from app.schemas.contracts import Rubric, TaskVariant
from app.services.repositories import (
    business_context_repository,
    case_repository,
    governance_repository,
    review_queue_repository,
    scoring_repository,
    session_repository,
)
from app.services.store import store


def test_case_repository_roundtrip(client):
    case = CaseSpec(
        tenant_id="tenant_a",
        title="Repo Case",
        scenario="Investigate retention drop.",
        artifacts=[],
        metrics=[],
        allowed_tools=["sql_workspace"],
    )
    saved = case_repository.save_case(case)
    assert saved.id == case.id

    fetched = case_repository.get_case(case.id)
    assert fetched is not None
    assert fetched.tenant_id == "tenant_a"

    rubric = Rubric(dimensions=[], failure_modes=[])
    case_repository.save_rubric(rubric)
    task_family = TaskFamily(
        case_id=case.id,
        variants=[TaskVariant(prompt="Variant A")],
        rubric_id=rubric.id,
    )
    case_repository.save_task_family(task_family)

    tenant = case_repository.tenant_for_task_family(task_family.id)
    assert tenant == "tenant_a"


def test_session_repository_roundtrip(client):
    session = Session(
        tenant_id="tenant_a",
        task_family_id=uuid4(),
        candidate_id="candidate_1",
        policy={"raw_content_opt_in": False, "retention_ttl_days": 30},
    )
    session_repository.save_session(session)

    fetched = session_repository.get_session(session.id)
    assert fetched is not None
    assert fetched.candidate_id == "candidate_1"

    session_repository.append_events(
        session.id,
        [
            {"event_type": "sql_query_run", "payload": {"row_count": 2}},
            {"event_type": "verification_step_completed", "payload": {}},
        ],
    )
    events = session_repository.list_events(session.id)
    assert len(events) == 2


def test_scoring_repository_roundtrip(client):
    session_id = uuid4()
    score = ScoreResult(
        session_id=session_id,
        objective_metrics={"query_error_rate": 0.0},
        overall_score=0.91,
        dimension_scores={"sql_quality": 0.91},
        confidence=0.91,
        needs_human_review=True,
    )
    interpretation = Interpretation(summary="Strong evidence reasoning.", suggestions=["Proceed to calibration round."])
    report = Report(session_id=session_id, score_result=score, interpretation=interpretation)
    review_item = ReviewQueueItem(
        session_id=session_id,
        tenant_id="tenant_a",
        reason="score_flagged_for_human_review",
        created_by="reviewer_1",
    )

    export_run_id = uuid4()
    scoring_repository.save_score(score)
    scoring_repository.save_report(report)
    scoring_repository.save_review_item(review_item)
    scoring_repository.save_export_run(export_run_id, session_id)

    fetched_score = scoring_repository.get_score(session_id)
    assert fetched_score is not None
    assert fetched_score.confidence == 0.91

    fetched_report = scoring_repository.get_report(session_id)
    assert fetched_report is not None
    assert fetched_report.interpretation.summary == "Strong evidence reasoning."

    fetched_run = scoring_repository.get_export_run(export_run_id)
    assert fetched_run is not None
    assert fetched_run["session_id"] == str(session_id)


def test_business_context_repository_roundtrip(client):
    pack = BusinessContextPack(
        tenant_id="tenant_a",
        name="Growth Analytics",
        role_focus="junior_data_analyst",
        job_description="Analyze growth funnel health and anomalies.",
        examples=["Investigate conversion drop by region."],
        constraints={"timebox_minutes": 45},
    )
    business_context_repository.save_pack(pack)

    fetched = business_context_repository.get_pack(pack.id)
    assert fetched is not None
    assert fetched.name == "Growth Analytics"

    listed = business_context_repository.list_packs("tenant_a")
    assert any(item.id == pack.id for item in listed)


def test_review_queue_repository_and_governance_repo(client):
    item = ReviewQueueItem(
        session_id=uuid4(),
        tenant_id="tenant_a",
        reason="score_flagged_for_human_review",
        created_by="reviewer_1",
    )
    review_queue_repository.save_item(item)

    open_items = review_queue_repository.list_items("tenant_a")
    assert len(open_items) == 1
    assert open_items[0].status == "open"

    governance_repository.append_audit_log(
        {
            "tenant_id": "tenant_a",
            "actor_role": "org_admin",
            "action": "unit_test",
            "resource_type": "governance",
            "resource_id": "test",
            "metadata": {"source": "test"},
        }
    )
    entries = list(store.audit_logs)
    assert len(entries) == 1
    assert entries[0]["action"] == "unit_test"
