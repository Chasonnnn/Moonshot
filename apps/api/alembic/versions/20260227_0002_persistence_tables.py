"""add repository persistence tables

Revision ID: 20260227_0002
Revises: 20260226_0001
Create Date: 2026-02-27 18:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260227_0002"
down_revision = "20260226_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "reports",
        sa.Column("session_id", sa.String(length=36), primary_key=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "export_runs",
        sa.Column("run_id", sa.String(length=36), primary_key=True),
        sa.Column("session_id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_export_runs_session_id", "export_runs", ["session_id"])

    op.create_table(
        "review_queue",
        sa.Column("session_id", sa.String(length=36), primary_key=True),
        sa.Column("tenant_id", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("reason", sa.String(length=255), nullable=False),
        sa.Column("created_by", sa.String(length=100), nullable=False),
        sa.Column("reviewer_note", sa.Text(), nullable=True),
        sa.Column("resolution", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_review_queue_tenant_id", "review_queue", ["tenant_id"])
    op.create_index("ix_review_queue_status", "review_queue", ["status"])

    op.create_table(
        "admin_policies",
        sa.Column("tenant_id", sa.String(length=100), primary_key=True),
        sa.Column("raw_content_default_opt_in", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("default_retention_ttl_days", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("max_retention_ttl_days", sa.Integer(), nullable=False, server_default="90"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "idempotency_cache",
        sa.Column("scope", sa.String(length=255), primary_key=True),
        sa.Column("key", sa.String(length=255), primary_key=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "session_sql_history",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("session_id", sa.String(length=36), nullable=False),
        sa.Column("item", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_session_sql_history_session_id", "session_sql_history", ["session_id"])

    op.create_table(
        "dashboard_states",
        sa.Column("session_id", sa.String(length=36), primary_key=True),
        sa.Column("state", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_index("ux_score_results_session_id", "score_results", ["session_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ux_score_results_session_id", table_name="score_results")

    op.drop_table("dashboard_states")

    op.drop_index("ix_session_sql_history_session_id", table_name="session_sql_history")
    op.drop_table("session_sql_history")

    op.drop_table("idempotency_cache")

    op.drop_table("admin_policies")

    op.drop_index("ix_review_queue_status", table_name="review_queue")
    op.drop_index("ix_review_queue_tenant_id", table_name="review_queue")
    op.drop_table("review_queue")

    op.drop_index("ix_export_runs_session_id", table_name="export_runs")
    op.drop_table("export_runs")

    op.drop_table("reports")
