"""initial moonshot schema

Revision ID: 20260226_0001
Revises: 
Create Date: 2026-02-26 16:45:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260226_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "business_context_packs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("role_focus", sa.String(length=64), nullable=False),
        sa.Column("job_description", sa.Text(), nullable=False),
        sa.Column("examples", sa.JSON(), nullable=False),
        sa.Column("constraints", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_business_context_packs_tenant_id", "business_context_packs", ["tenant_id"])

    op.create_table(
        "case_specs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("context_pack_id", sa.String(length=36), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("scenario", sa.Text(), nullable=False),
        sa.Column("artifacts", sa.JSON(), nullable=False),
        sa.Column("metrics", sa.JSON(), nullable=False),
        sa.Column("allowed_tools", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("version", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_case_specs_tenant_id", "case_specs", ["tenant_id"])

    op.create_table(
        "rubrics",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("dimensions", sa.JSON(), nullable=False),
        sa.Column("failure_modes", sa.JSON(), nullable=False),
        sa.Column("version", sa.String(length=32), nullable=False),
    )

    op.create_table(
        "task_families",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("case_id", sa.String(length=36), nullable=False),
        sa.Column("variants", sa.JSON(), nullable=False),
        sa.Column("rubric_id", sa.String(length=36), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("version", sa.String(length=32), nullable=False),
    )
    op.create_index("ix_task_families_case_id", "task_families", ["case_id"])
    op.create_index("ix_task_families_rubric_id", "task_families", ["rubric_id"])

    op.create_table(
        "sessions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("task_family_id", sa.String(length=36), nullable=False),
        sa.Column("candidate_id", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("policy", sa.JSON(), nullable=False),
        sa.Column("final_response", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_sessions_tenant_id", "sessions", ["tenant_id"])
    op.create_index("ix_sessions_task_family_id", "sessions", ["task_family_id"])
    op.create_index("ix_sessions_candidate_id", "sessions", ["candidate_id"])

    op.create_table(
        "event_logs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("session_id", sa.String(length=36), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_event_logs_session_id", "event_logs", ["session_id"])
    op.create_index("ix_event_logs_event_type", "event_logs", ["event_type"])

    op.create_table(
        "score_results",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("session_id", sa.String(length=36), nullable=False),
        sa.Column("objective_metrics", sa.JSON(), nullable=False),
        sa.Column("dimension_scores", sa.JSON(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("needs_human_review", sa.Boolean(), nullable=False),
        sa.Column("scorer_version", sa.String(length=32), nullable=False),
        sa.Column("rubric_version", sa.String(length=32), nullable=False),
        sa.Column("task_family_version", sa.String(length=32), nullable=False),
        sa.Column("model_hash", sa.String(length=128), nullable=False),
    )
    op.create_index("ix_score_results_session_id", "score_results", ["session_id"])

    op.create_table(
        "redteam_runs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("target_type", sa.String(length=64), nullable=False),
        sa.Column("target_id", sa.String(length=36), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("findings", sa.JSON(), nullable=False),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("actor_role", sa.String(length=64), nullable=False),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("resource_type", sa.String(length=64), nullable=False),
        sa.Column("resource_id", sa.String(length=64), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_audit_logs_tenant_id", "audit_logs", ["tenant_id"])
    op.create_index("ix_audit_logs_actor_role", "audit_logs", ["actor_role"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_resource_type", "audit_logs", ["resource_type"])


def downgrade() -> None:
    op.drop_index("ix_audit_logs_resource_type", table_name="audit_logs")
    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
    op.drop_index("ix_audit_logs_actor_role", table_name="audit_logs")
    op.drop_index("ix_audit_logs_tenant_id", table_name="audit_logs")
    op.drop_table("audit_logs")

    op.drop_table("redteam_runs")

    op.drop_index("ix_score_results_session_id", table_name="score_results")
    op.drop_table("score_results")

    op.drop_index("ix_event_logs_event_type", table_name="event_logs")
    op.drop_index("ix_event_logs_session_id", table_name="event_logs")
    op.drop_table("event_logs")

    op.drop_index("ix_sessions_candidate_id", table_name="sessions")
    op.drop_index("ix_sessions_task_family_id", table_name="sessions")
    op.drop_index("ix_sessions_tenant_id", table_name="sessions")
    op.drop_table("sessions")

    op.drop_index("ix_task_families_rubric_id", table_name="task_families")
    op.drop_index("ix_task_families_case_id", table_name="task_families")
    op.drop_table("task_families")

    op.drop_table("rubrics")

    op.drop_index("ix_case_specs_tenant_id", table_name="case_specs")
    op.drop_table("case_specs")

    op.drop_index("ix_business_context_packs_tenant_id", table_name="business_context_packs")
    op.drop_table("business_context_packs")
