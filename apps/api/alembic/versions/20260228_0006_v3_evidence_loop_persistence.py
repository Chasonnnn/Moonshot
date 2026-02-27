"""add v0.3 evidence-loop persistence tables

Revision ID: 20260228_0006
Revises: 20260228_0005
Create Date: 2026-02-28 22:50:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260228_0006"
down_revision = "20260228_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "task_quality_signals",
        sa.Column("task_family_id", sa.String(length=36), primary_key=True),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("variant_count", sa.Integer(), nullable=False),
        sa.Column("diversity_score", sa.Float(), nullable=False),
        sa.Column("clarity_score", sa.Float(), nullable=False),
        sa.Column("realism_score", sa.Float(), nullable=False),
        sa.Column("variant_stability_score", sa.Float(), nullable=False),
        sa.Column("admin_acceptance_rate", sa.Float(), nullable=False),
        sa.Column("mean_edit_distance", sa.Float(), nullable=False),
        sa.Column("rubric_leakage_detected", sa.Boolean(), nullable=False),
        sa.Column("quality_score", sa.Float(), nullable=False),
        sa.Column("evaluated_by_role", sa.String(length=64), nullable=True),
        sa.Column("evaluated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_task_quality_signals_tenant_id", "task_quality_signals", ["tenant_id"])

    op.create_table(
        "coach_feedback",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("session_id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("candidate_id", sa.String(length=100), nullable=False),
        sa.Column("helpful", sa.Boolean(), nullable=False),
        sa.Column("confusion_tags", sa.JSON(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_coach_feedback_session_id", "coach_feedback", ["session_id"])
    op.create_index("ix_coach_feedback_tenant_id", "coach_feedback", ["tenant_id"])
    op.create_index("ix_coach_feedback_candidate_id", "coach_feedback", ["candidate_id"])

    op.create_table(
        "interpretation_views",
        sa.Column("view_id", sa.String(length=36), primary_key=True),
        sa.Column("session_id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_interpretation_views_session_id", "interpretation_views", ["session_id"])
    op.create_index("ix_interpretation_views_tenant_id", "interpretation_views", ["tenant_id"])

    op.create_table(
        "context_injection_traces",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("session_id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("agent_type", sa.String(length=64), nullable=False),
        sa.Column("actor_role", sa.String(length=64), nullable=False),
        sa.Column("mode", sa.String(length=32), nullable=False),
        sa.Column("context_keys", sa.JSON(), nullable=False),
        sa.Column("precedence_order", sa.JSON(), nullable=False),
        sa.Column("policy_version", sa.String(length=32), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_context_injection_traces_session_id", "context_injection_traces", ["session_id"])
    op.create_index("ix_context_injection_traces_tenant_id", "context_injection_traces", ["tenant_id"])

    op.create_table(
        "fairness_smoke_runs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("scope", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("summary", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_fairness_smoke_runs_tenant_id", "fairness_smoke_runs", ["tenant_id"])
    op.create_index("ix_fairness_smoke_runs_status", "fairness_smoke_runs", ["status"])


def downgrade() -> None:
    op.drop_index("ix_fairness_smoke_runs_status", table_name="fairness_smoke_runs")
    op.drop_index("ix_fairness_smoke_runs_tenant_id", table_name="fairness_smoke_runs")
    op.drop_table("fairness_smoke_runs")

    op.drop_index("ix_context_injection_traces_tenant_id", table_name="context_injection_traces")
    op.drop_index("ix_context_injection_traces_session_id", table_name="context_injection_traces")
    op.drop_table("context_injection_traces")

    op.drop_index("ix_interpretation_views_tenant_id", table_name="interpretation_views")
    op.drop_index("ix_interpretation_views_session_id", table_name="interpretation_views")
    op.drop_table("interpretation_views")

    op.drop_index("ix_coach_feedback_candidate_id", table_name="coach_feedback")
    op.drop_index("ix_coach_feedback_tenant_id", table_name="coach_feedback")
    op.drop_index("ix_coach_feedback_session_id", table_name="coach_feedback")
    op.drop_table("coach_feedback")

    op.drop_index("ix_task_quality_signals_tenant_id", table_name="task_quality_signals")
    op.drop_table("task_quality_signals")
