"""Tests for case dataset and deliverable schemas — TDD: written before implementation."""
from uuid import uuid4

from app.schemas.contracts import (
    AssessmentFormat,
    CaseDataset,
    CasePart,
    CaseSpec,
    DatasetColumn,
    DatasetSchema,
    Deliverable,
    DeliverableSubmitRequest,
    OralResponse,
    PrecomputedQuery,
)
from app.models.entities import CaseDatasetModel, DeliverableModel, OralResponseModel


def test_dataset_column_basic():
    col = DatasetColumn(name="id", dtype="string", description="Primary key", sample_values=["R001"])
    assert col.name == "id"
    assert col.dtype == "string"
    assert col.sample_values == ["R001"]


def test_dataset_schema_with_columns():
    schema = DatasetSchema(columns=[
        DatasetColumn(name="a", dtype="int"),
        DatasetColumn(name="b", dtype="float"),
    ])
    assert len(schema.columns) == 2


def test_precomputed_query():
    pq = PrecomputedQuery(
        pattern="SELECT * FROM t LIMIT 10",
        normalized="select * from t limit 10",
        columns=["a", "b"],
        rows=[{"a": 1, "b": 2}],
    )
    assert pq.pattern == "SELECT * FROM t LIMIT 10"
    assert pq.rows[0]["a"] == 1


def test_case_dataset_full():
    ds = CaseDataset(
        case_id=uuid4(),
        name="test_dataset",
        description="A test dataset",
        row_count=100,
        file_path="/tmp/test.csv",
        dataset_schema=DatasetSchema(columns=[DatasetColumn(name="x", dtype="int")]),
        precomputed_queries=[PrecomputedQuery(pattern="SELECT 1", normalized="select 1")],
    )
    assert ds.name == "test_dataset"
    assert ds.row_count == 100
    assert len(ds.precomputed_queries) == 1


def test_case_part():
    part = CasePart(
        title="Data Exploration",
        description="Explore the dataset",
        part_type="exploration",
        time_limit_minutes=120,
        deliverable_type="notebook",
    )
    assert part.title == "Data Exploration"
    assert part.time_limit_minutes == 120


def test_case_spec_has_assessment_format():
    spec = CaseSpec(
        tenant_id="t1",
        title="Test Case",
        scenario="Analyze data",
        assessment_format="case_study",
    )
    assert spec.assessment_format == "case_study"


def test_case_spec_default_assessment_format():
    spec = CaseSpec(tenant_id="t1", title="Test", scenario="s")
    assert spec.assessment_format == "analysis_simulation"


def test_case_spec_has_datasets_and_parts():
    spec = CaseSpec(
        tenant_id="t1",
        title="Test",
        scenario="s",
        datasets=[CaseDataset(case_id=uuid4(), name="ds1")],
        parts=[CasePart(title="Part 1")],
    )
    assert len(spec.datasets) == 1
    assert len(spec.parts) == 1


def test_deliverable_model_exists():
    assert DeliverableModel.__tablename__ == "deliverables"


def test_oral_response_model_exists():
    assert OralResponseModel.__tablename__ == "oral_responses"


def test_case_dataset_model_exists():
    assert CaseDatasetModel.__tablename__ == "case_datasets"


def test_deliverable_schema():
    d = Deliverable(session_id=uuid4(), content_markdown="# Report", status="draft")
    assert d.content_markdown == "# Report"
    assert d.status == "draft"


def test_deliverable_submit_request():
    req = DeliverableSubmitRequest(
        content_markdown="# Final report",
        embedded_artifacts=["art-1"],
    )
    assert req.content_markdown == "# Final report"
    assert req.embedded_artifacts == ["art-1"]


def test_oral_response_schema():
    response = OralResponse(
        session_id=uuid4(),
        clip_type="presentation",
        duration_ms=180000,
        mime_type="audio/webm",
        status="transcribed",
        transcript_text="Summary of findings.",
        transcription_model="gpt-4o-transcribe",
        request_id="req-oral-1",
        audio_retained=False,
    )
    assert response.clip_type == "presentation"
    assert response.transcript_text == "Summary of findings."


def test_assessment_format_literal():
    # Valid values
    for fmt in ("analysis_simulation", "case_study", "sql_proficiency"):
        spec = CaseSpec(tenant_id="t1", title="T", scenario="s", assessment_format=fmt)
        assert spec.assessment_format == fmt
