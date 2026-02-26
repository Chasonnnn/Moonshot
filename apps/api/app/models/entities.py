from sqlalchemy import Boolean, DateTime, Float, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BusinessContextPackModel(Base):
    __tablename__ = "business_context_packs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(100), index=True)
    name: Mapped[str] = mapped_column(String(255))
    role_focus: Mapped[str] = mapped_column(String(64))
    job_description: Mapped[str] = mapped_column(Text)
    examples: Mapped[dict] = mapped_column(JSON)
    constraints: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[str] = mapped_column(DateTime(timezone=True))


class CaseSpecModel(Base):
    __tablename__ = "case_specs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(100), index=True)
    context_pack_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    title: Mapped[str] = mapped_column(String(255))
    scenario: Mapped[str] = mapped_column(Text)
    artifacts: Mapped[dict] = mapped_column(JSON)
    metrics: Mapped[dict] = mapped_column(JSON)
    allowed_tools: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(32))
    version: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[str] = mapped_column(DateTime(timezone=True))


class TaskFamilyModel(Base):
    __tablename__ = "task_families"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    case_id: Mapped[str] = mapped_column(String(36), index=True)
    variants: Mapped[dict] = mapped_column(JSON)
    rubric_id: Mapped[str] = mapped_column(String(36), index=True)
    status: Mapped[str] = mapped_column(String(32))
    version: Mapped[str] = mapped_column(String(32))


class RubricModel(Base):
    __tablename__ = "rubrics"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    dimensions: Mapped[dict] = mapped_column(JSON)
    failure_modes: Mapped[dict] = mapped_column(JSON)
    version: Mapped[str] = mapped_column(String(32))


class SessionModel(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(100), index=True)
    task_family_id: Mapped[str] = mapped_column(String(36), index=True)
    candidate_id: Mapped[str] = mapped_column(String(100), index=True)
    status: Mapped[str] = mapped_column(String(32))
    policy: Mapped[dict] = mapped_column(JSON)
    final_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[str] = mapped_column(DateTime(timezone=True))


class EventLogModel(Base):
    __tablename__ = "event_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(String(36), index=True)
    event_type: Mapped[str] = mapped_column(String(64), index=True)
    payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True))


class ScoreResultModel(Base):
    __tablename__ = "score_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(String(36), index=True)
    objective_metrics: Mapped[dict] = mapped_column(JSON)
    dimension_scores: Mapped[dict] = mapped_column(JSON)
    confidence: Mapped[float] = mapped_column(Float)
    needs_human_review: Mapped[bool] = mapped_column(Boolean)
    scorer_version: Mapped[str] = mapped_column(String(32))
    rubric_version: Mapped[str] = mapped_column(String(32))
    task_family_version: Mapped[str] = mapped_column(String(32))
    model_hash: Mapped[str] = mapped_column(String(128))


class RedTeamRunModel(Base):
    __tablename__ = "redteam_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    target_type: Mapped[str] = mapped_column(String(64))
    target_id: Mapped[str] = mapped_column(String(36))
    status: Mapped[str] = mapped_column(String(32))
    findings: Mapped[dict] = mapped_column(JSON)


class AuditLogModel(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(100), index=True)
    actor_role: Mapped[str] = mapped_column(String(64), index=True)
    action: Mapped[str] = mapped_column(String(64), index=True)
    resource_type: Mapped[str] = mapped_column(String(64), index=True)
    resource_id: Mapped[str] = mapped_column(String(64), index=True)
    metadata: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True))
