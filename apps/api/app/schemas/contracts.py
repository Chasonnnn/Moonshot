from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class MetricSpec(BaseModel):
    key: str
    description: str
    formula: str
    source_events: list[str] = Field(default_factory=list)


class BusinessContextPackCreate(BaseModel):
    name: str
    role_focus: str
    job_description: str
    examples: list[str] = Field(default_factory=list)
    constraints: dict[str, Any] = Field(default_factory=dict)


class BusinessContextPackUpdate(BaseModel):
    name: str | None = None
    role_focus: str | None = None
    job_description: str | None = None
    examples: list[str] | None = None
    constraints: dict[str, Any] | None = None
    status: str | None = None


class BusinessContextPack(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    tenant_id: str
    name: str
    role_focus: str
    job_description: str
    examples: list[str] = Field(default_factory=list)
    constraints: dict[str, Any] = Field(default_factory=dict)
    status: str = "draft"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DatasetColumn(BaseModel):
    name: str
    dtype: str
    description: str = ""
    sample_values: list[str] = Field(default_factory=list)


class DatasetSchema(BaseModel):
    columns: list[DatasetColumn] = Field(default_factory=list)


class PrecomputedQuery(BaseModel):
    pattern: str
    normalized: str
    columns: list[str] = Field(default_factory=list)
    rows: list[dict[str, Any]] = Field(default_factory=list)


class CaseDataset(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    case_id: UUID | None = None
    name: str
    description: str = ""
    row_count: int = 0
    file_path: str = ""
    dataset_schema: DatasetSchema = Field(default_factory=DatasetSchema)
    precomputed_queries: list[PrecomputedQuery] = Field(default_factory=list)


class CasePart(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    title: str
    description: str = ""
    part_type: str = "exploration"
    time_limit_minutes: int | None = None
    deliverable_type: str | None = None


AssessmentFormat = Literal["analysis_simulation", "case_study", "sql_proficiency"]


class Deliverable(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    session_id: UUID
    part_id: UUID | None = None
    content_markdown: str = ""
    embedded_artifacts: list[str] = Field(default_factory=list)
    status: str = "draft"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DeliverableSubmitRequest(BaseModel):
    content_markdown: str
    embedded_artifacts: list[str] = Field(default_factory=list)


class DeliverableListResponse(BaseModel):
    items: list[Deliverable] = Field(default_factory=list)


class CaseCreate(BaseModel):
    context_pack_id: UUID | None = None
    title: str
    scenario: str
    artifacts: list[dict[str, Any]] = Field(default_factory=list)
    metrics: list[MetricSpec] = Field(default_factory=list)
    allowed_tools: list[str] = Field(default_factory=list)


class CaseUpdate(BaseModel):
    title: str | None = None
    scenario: str | None = None
    artifacts: list[dict[str, Any]] | None = None
    metrics: list[MetricSpec] | None = None
    allowed_tools: list[str] | None = None
    status: str | None = None


GenerateMode = Literal["live", "fixture"]


class CaseGenerateRequest(BaseModel):
    mode: GenerateMode = "live"
    template_id: str | None = None
    variant_count: int | None = Field(default=None, ge=5, le=20)
    model_override: str | None = None
    reasoning_effort: str | None = None
    thinking_budget_tokens: int | None = None


class CaseSpec(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    tenant_id: str
    context_pack_id: UUID | None = None
    title: str
    scenario: str
    artifacts: list[dict[str, Any]] = Field(default_factory=list)
    metrics: list[MetricSpec] = Field(default_factory=list)
    allowed_tools: list[str] = Field(default_factory=list)
    status: str = "draft"
    version: str = "0.1.0"
    assessment_format: AssessmentFormat = "analysis_simulation"
    datasets: list[CaseDataset] = Field(default_factory=list)
    parts: list[CasePart] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TaskVariant(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    prompt: str
    skill: str | None = None
    difficulty_level: str | None = None
    round_hint: str | None = None
    estimated_minutes: int | None = None
    deliverables: list[str] = Field(default_factory=list)
    artifact_refs: list[str] = Field(default_factory=list)


class RubricDimension(BaseModel):
    key: str
    anchor: str
    evaluation_points: list[str] = Field(default_factory=list)
    evidence_signals: list[str] = Field(default_factory=list)
    common_failure_modes: list[str] = Field(default_factory=list)
    score_bands: dict[str, str] = Field(default_factory=dict)


class Rubric(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    dimensions: list[RubricDimension]
    failure_modes: list[str] = Field(default_factory=list)
    version: str = "0.1.0"


class ScoringConfig(BaseModel):
    enabled: bool = True
    llm_call_budget: int = 8
    min_verification_steps: int = 1
    max_query_error_rate: float = 0.5
    policy_violation_penalty: float = 0.25
    idle_threshold_ms: int | None = None
    custom_rules: dict[str, Any] = Field(default_factory=dict)


class TaskFamily(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    case_id: UUID
    variants: list[TaskVariant] = Field(default_factory=list)
    rubric_id: UUID
    rubric: Rubric | None = None
    status: str = "generated"
    version: str = "0.1.0"
    generation_diagnostics: dict[str, Any] = Field(default_factory=dict)
    scoring_config: ScoringConfig = Field(default_factory=ScoringConfig)


class ModelInvocationTrace(BaseModel):
    provider: str
    model: str
    prompt_hash: str
    latency_ms: int


class GenerationResult(BaseModel):
    task_family: TaskFamily
    rubric: Rubric
    model_trace: ModelInvocationTrace | None = None


class TaskFamilyPublishRequest(BaseModel):
    approver_note: str | None = None


class TaskFamilyReviewRequest(BaseModel):
    decision: str
    review_note: str | None = None


class SessionCreate(BaseModel):
    task_family_id: UUID
    candidate_id: str
    policy: dict[str, Any] = Field(
        default_factory=lambda: {
            "raw_content_opt_in": False,
            "retention_ttl_days": 90,
            "time_limit_minutes": None,
            "coach_mode": "assessment",
        }
    )


class Session(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    tenant_id: str
    task_family_id: UUID
    candidate_id: str
    status: str = "active"
    policy: dict[str, Any] = Field(default_factory=dict)
    final_response: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SessionDetail(Session):
    task_prompt: str


class EventItem(BaseModel):
    event_type: str
    payload: dict[str, Any] = Field(default_factory=dict)


class EventsIngestRequest(BaseModel):
    events: list[EventItem] = Field(default_factory=list)


class EventIngestResponse(BaseModel):
    accepted: int


class SessionEvent(BaseModel):
    event_type: str
    payload: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime


class SessionEventListResponse(BaseModel):
    items: list[SessionEvent] = Field(default_factory=list)
    next_cursor: int | None = None
    limit: int
    total: int


class SQLRunRequest(BaseModel):
    query: str


class SQLHistoryItem(BaseModel):
    query: str
    ok: bool
    row_count: int | None = None
    columns: list[str] = Field(default_factory=list)
    error: str | None = None
    executed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SQLRunResponse(BaseModel):
    ok: bool
    row_count: int
    columns: list[str] = Field(default_factory=list)
    rows: list[dict[str, Any]] = Field(default_factory=list)
    runtime_ms: int


class SQLHistoryResponse(BaseModel):
    items: list[SQLHistoryItem] = Field(default_factory=list)


class PythonRunRequest(BaseModel):
    code: str
    template_id: str | None = None
    round_id: str | None = None
    dataset_id: str | None = None


class RuntimeArtifact(BaseModel):
    name: str
    mime_type: str
    uri: str
    bytes: int
    kind: str


class PythonHistoryItem(BaseModel):
    code: str
    ok: bool
    stdout: str | None = None
    stderr: str | None = None
    plot_url: str | None = None
    artifacts: list[RuntimeArtifact] = Field(default_factory=list)
    error: str | None = None
    runtime_ms: int = 0
    executed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PythonRunResponse(BaseModel):
    ok: bool
    stdout: str | None = None
    stderr: str | None = None
    plot_url: str | None = None
    artifacts: list[RuntimeArtifact] = Field(default_factory=list)
    runtime_ms: int


class PythonHistoryResponse(BaseModel):
    items: list[PythonHistoryItem] = Field(default_factory=list)


class CoachMessageRequest(BaseModel):
    message: str
    model_override: str | None = None
    reasoning_effort: str | None = None
    thinking_budget_tokens: int | None = None


class CoachResponse(BaseModel):
    allowed: bool
    response: str
    policy_reason: str
    policy_decision_code: str | None = None
    policy_version: str | None = None
    policy_hash: str | None = None
    blocked_rule_id: str | None = None


SessionMode = Literal["practice", "assessment", "assessment_no_ai", "assessment_ai_assisted"]


class SessionModeRequest(BaseModel):
    mode: SessionMode


class SessionScoreRequest(BaseModel):
    mode: GenerateMode = "live"
    template_id: str | None = None
    model_override: str | None = None
    reasoning_effort: str | None = None
    thinking_budget_tokens: int | None = None


class CoachFeedbackRequest(BaseModel):
    helpful: bool
    confusion_tags: list[str] = Field(default_factory=list)
    notes: str | None = None


class CoachFeedback(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    session_id: UUID
    candidate_id: str
    helpful: bool
    confusion_tags: list[str] = Field(default_factory=list)
    notes: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SessionSubmitRequest(BaseModel):
    final_response: str | None = None


class DimensionScoreOutput(BaseModel):
    key: str
    score: float
    rationale: str
    failure_modes_matched: list[str] = Field(default_factory=list)
    confidence: float


class HolisticScoreOutput(BaseModel):
    overall_score: float
    overall_confidence: float
    consistency_flags: list[str] = Field(default_factory=list)
    narrative_summary: str
    suggestions: list[str] = Field(default_factory=list)


class ScoreResult(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    session_id: UUID
    objective_metrics: dict[str, Any]
    dimension_scores: dict[str, float]
    dimension_evidence: dict[str, DimensionScoreOutput] = Field(default_factory=dict)
    confidence: float
    needs_human_review: bool
    scorer_version: str = "0.2.0"
    rubric_version: str = "0.1.0"
    task_family_version: str = "0.1.0"
    model_hash: str = "local-baseline"
    llm_traces: list[ModelInvocationTrace] = Field(default_factory=list)
    trigger_codes: list[str] = Field(default_factory=list)
    trigger_impacts: list[dict[str, float | str]] = Field(default_factory=list)
    scored_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Interpretation(BaseModel):
    summary: str
    suggestions: list[str] = Field(default_factory=list)
    audience: str = "reviewer_admin_only"


class Report(BaseModel):
    session_id: UUID
    score_result: ScoreResult
    interpretation: Interpretation


class ReportSummary(BaseModel):
    session_id: UUID
    session_status: str
    report_available: bool
    confidence: float | None = None
    needs_human_review: bool | None = None
    trigger_codes: list[str] = Field(default_factory=list)
    trigger_count: int = 0
    last_scored_at: datetime | None = None
    scoring_version_lock: ScoringVersionLock | None = None
    has_human_review: bool = False
    final_score_source: Literal["model", "human_override"] | None = None
    final_confidence: float | None = None


class HumanReviewUpdateRequest(BaseModel):
    notes_markdown: str | None = None
    tags: list[str] | None = None
    override_overall_score: float | None = Field(default=None, ge=0.0, le=1.0)
    override_confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    dimension_overrides: dict[str, float] | None = None


class HumanReviewRecord(BaseModel):
    session_id: UUID
    tenant_id: str
    notes_markdown: str | None = None
    tags: list[str] = Field(default_factory=list)
    override_overall_score: float | None = None
    override_confidence: float | None = None
    dimension_overrides: dict[str, float] = Field(default_factory=dict)
    reviewer_id: str | None = None
    created_at: datetime
    updated_at: datetime


class InterpretationRequest(BaseModel):
    focus_dimensions: list[str] = Field(default_factory=list)
    include_sensitivity: bool = False
    weight_overrides: dict[str, float] = Field(default_factory=dict)


class ScoringVersionLock(BaseModel):
    scorer_version: str
    rubric_version: str
    task_family_version: str
    model_hash: str


class InterpretationView(BaseModel):
    view_id: UUID = Field(default_factory=uuid4)
    session_id: UUID
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    focus_dimensions: list[str] = Field(default_factory=list)
    include_sensitivity: bool = False
    weight_overrides: dict[str, float] = Field(default_factory=dict)
    breakdown: dict[str, Any] = Field(default_factory=dict)
    caveats: list[str] = Field(default_factory=list)
    scoring_version_lock: ScoringVersionLock


class InterpretationViewListResponse(BaseModel):
    items: list[InterpretationView] = Field(default_factory=list)


class TaskQualitySignal(BaseModel):
    task_family_id: UUID
    variant_count: int
    diversity_score: float
    clarity_score: float
    realism_score: float
    variant_stability_score: float
    admin_acceptance_rate: float
    mean_edit_distance: float
    rubric_leakage_detected: bool
    diversity_fail_reason: str | None = None
    leakage_rule_hits: list[str] = Field(default_factory=list)
    grounding_coverage_score: float = 0.0
    quality_score: float
    evaluated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    evaluated_by_role: str | None = None


MemoryLayer = Literal["org", "content", "episode"]
MemorySourceType = Literal["admin_approved", "model_inferred"]
MemoryStatus = Literal["proposed", "reviewed", "approved", "active", "deprecated"]
MemoryConsumer = Literal["coach", "evaluator", "codesign"]


class MemoryEntry(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    tenant_id: str
    layer: MemoryLayer
    source_entity_type: str
    source_entity_id: str
    source_type: MemorySourceType
    status: MemoryStatus
    visibility_scope: list[str] = Field(default_factory=list)
    created_by: str | None = None
    reviewed_by: str | None = None
    policy_version: str | None = None
    change_reason: str | None = None
    text_content: str
    metadata_json: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MemoryEntryListResponse(BaseModel):
    items: list[MemoryEntry] = Field(default_factory=list)


class MemoryChunk(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    memory_entry_id: UUID
    tenant_id: str
    chunk_index: int
    text_content: str
    metadata_json: dict[str, Any] = Field(default_factory=dict)
    fts_document: str
    embedding: list[float] = Field(default_factory=list)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SessionMemoryDigest(BaseModel):
    session_id: UUID
    tenant_id: str
    summary_text: str
    facts_json: dict[str, Any] = Field(default_factory=dict)
    risk_signals: list[str] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list)
    last_event_offset: int = 0
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MemoryAssemblerRequest(BaseModel):
    tenant_id: str
    actor_role: str
    consumer: MemoryConsumer
    query_text: str
    session_id: UUID | None = None
    token_budget_override: int | None = None
    max_chunks_override: int | None = None


class ContextInjectionTrace(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    session_id: UUID
    tenant_id: str
    agent_type: str
    actor_role: str
    mode: str
    context_keys: list[str] = Field(default_factory=list)
    precedence_order: list[str] = Field(
        default_factory=lambda: [
            "task_rubric",
            "org_policy",
            "role_profile",
            "learner_progress",
            "aggregated_insights",
        ]
    )
    policy_version: str | None = None
    policy_hash: str | None = None
    memory_entry_ids: list[UUID] = Field(default_factory=list)
    chunk_ids: list[UUID] = Field(default_factory=list)
    ranking_features: dict[str, Any] = Field(default_factory=dict)
    query_text: str | None = None
    token_budget: int | None = None
    assembled_context_hash: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ContextInjectionTraceListResponse(BaseModel):
    items: list[ContextInjectionTrace] = Field(default_factory=list)


class FairnessSmokeRunCreate(BaseModel):
    scope: str = "tenant_recent"
    include_language_proxy: bool = True
    target_session_id: UUID | None = None


class FairnessSmokeRun(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    tenant_id: str
    scope: str
    status: str = "completed"
    created_by: str | None = None
    submitted_job_id: UUID | None = None
    request_id: str | None = None
    target_session_id: UUID | None = None
    evidence_refs: dict[str, Any] = Field(default_factory=dict)
    summary: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ExportCreateRequest(BaseModel):
    session_id: UUID


class ExportBundle(BaseModel):
    model_config = {"populate_by_name": True}

    run_id: UUID
    schema_version: str
    csv_headers: list[str] = Field(default_factory=list)
    csv: str
    json_payload: dict[str, Any] = Field(alias="json")
    tableau_schema: dict[str, Any]


class RedTeamRunCreate(BaseModel):
    target_type: str
    target_id: UUID


class RedTeamRun(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    tenant_id: str | None = None
    target_type: str
    target_id: UUID
    status: str
    created_by: str | None = None
    submitted_job_id: UUID | None = None
    request_id: str | None = None
    evidence_refs: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    findings: list[dict[str, Any]] = Field(default_factory=list)


class ReviewQueueItem(BaseModel):
    session_id: UUID
    tenant_id: str
    status: str = "open"
    reason: str
    created_by: str
    reviewer_note: str | None = None
    resolution: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ReviewQueueResolveRequest(BaseModel):
    decision: str
    reviewer_note: str | None = None


class AdminPolicy(BaseModel):
    tenant_id: str
    raw_content_default_opt_in: bool = False
    default_retention_ttl_days: int = 90
    max_retention_ttl_days: int = 90


class AdminPolicyUpdateRequest(BaseModel):
    raw_content_default_opt_in: bool | None = None
    default_retention_ttl_days: int | None = None
    max_retention_ttl_days: int | None = None


class PurgeExpiredRequest(BaseModel):
    dry_run: bool = False


class PurgeExpiredResponse(BaseModel):
    purged_sessions: int
    dry_run: bool


class DashboardState(BaseModel):
    filters: dict[str, Any] = Field(default_factory=dict)
    view: str = "default"
    annotations: list[str] = Field(default_factory=list)


class DashboardActionRequest(BaseModel):
    action_type: str
    payload: dict[str, Any] = Field(default_factory=dict)


class AuditLog(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    tenant_id: str
    actor_role: str
    action: str
    resource_type: str
    resource_id: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    prev_hash: str = "GENESIS"
    entry_hash: str = "UNSET"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AuditChainVerificationResponse(BaseModel):
    valid: bool
    checked_entries: int
    error_code: str | None = None
    error_detail: str | None = None
    failed_index: int | None = None


class ErrorResponse(BaseModel):
    detail: str
    error_code: str | None = None
    error_detail: str | None = None
    request_id: str | None = None


class MetaVersion(BaseModel):
    api_version: str
    schema_version: str


class ModelOptionStatus(BaseModel):
    model: str
    available: bool
    resolved_model: str | None = None


class ModelOptionsResponse(BaseModel):
    required_models: list[str] = Field(default_factory=list)
    defaults_by_agent: dict[str, str] = Field(default_factory=dict)
    options: list[ModelOptionStatus] = Field(default_factory=list)


class AuthTokenRequest(BaseModel):
    role: str
    user_id: str
    tenant_id: str
    expires_in_seconds: int | None = None


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    kid: str


class JobAccepted(BaseModel):
    job_id: UUID
    status: str
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class JobStatus(BaseModel):
    job_id: UUID
    status: str
    job_type: str | None = None
    target_type: str | None = None
    target_id: str | None = None
    progress: int = 0
    current_step: str | None = None
    error_code: str | None = None
    error_detail: str | None = None
    submitted_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None
    next_attempt_at: datetime | None = None
    lease_owner: str | None = None
    lease_expires_at: datetime | None = None
    attempt_count: int = 0
    max_attempts: int = 0
    last_error_code: str | None = None


class JobStatusListResponse(BaseModel):
    items: list[JobStatus] = Field(default_factory=list)


class SLOProbeResult(BaseModel):
    status: str
    latency_ms: int
    detail: dict[str, Any] = Field(default_factory=dict)


class SLOProbeResponse(BaseModel):
    overall_status: str
    probes: dict[str, SLOProbeResult] = Field(default_factory=dict)


class WorkerStatus(BaseModel):
    worker_id: str
    last_seen_at: datetime
    seconds_since_last_seen: int
    status: str
    last_job_id: str | None = None


class WorkerHealthResponse(BaseModel):
    overall_status: str
    workers: list[WorkerStatus] = Field(default_factory=list)
    stale_leases: int = 0
    checked_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class JobResultResponse(BaseModel):
    job_id: UUID
    status: str
    result: dict[str, Any]
