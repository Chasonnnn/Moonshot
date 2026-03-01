"""add governance run provenance fields

Revision ID: 20260301_0010
Revises: 20260301_0009
Create Date: 2026-03-01 16:25:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260301_0010"
down_revision = "20260301_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("redteam_runs", sa.Column("tenant_id", sa.String(length=100), nullable=True))
    op.add_column("redteam_runs", sa.Column("created_by", sa.String(length=100), nullable=True))
    op.add_column("redteam_runs", sa.Column("submitted_job_id", sa.String(length=36), nullable=True))
    op.add_column("redteam_runs", sa.Column("request_id", sa.String(length=64), nullable=True))
    op.add_column("redteam_runs", sa.Column("evidence_refs", sa.JSON(), nullable=True))
    op.add_column("redteam_runs", sa.Column("created_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_redteam_runs_tenant_id", "redteam_runs", ["tenant_id"], unique=False)
    op.create_index("ix_redteam_runs_submitted_job_id", "redteam_runs", ["submitted_job_id"], unique=False)

    op.add_column("fairness_smoke_runs", sa.Column("created_by", sa.String(length=100), nullable=True))
    op.add_column("fairness_smoke_runs", sa.Column("submitted_job_id", sa.String(length=36), nullable=True))
    op.add_column("fairness_smoke_runs", sa.Column("request_id", sa.String(length=64), nullable=True))
    op.add_column("fairness_smoke_runs", sa.Column("target_session_id", sa.String(length=36), nullable=True))
    op.add_column("fairness_smoke_runs", sa.Column("evidence_refs", sa.JSON(), nullable=True))
    op.create_index("ix_fairness_smoke_runs_submitted_job_id", "fairness_smoke_runs", ["submitted_job_id"], unique=False)
    op.create_index("ix_fairness_smoke_runs_target_session_id", "fairness_smoke_runs", ["target_session_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_fairness_smoke_runs_target_session_id", table_name="fairness_smoke_runs")
    op.drop_index("ix_fairness_smoke_runs_submitted_job_id", table_name="fairness_smoke_runs")
    op.drop_column("fairness_smoke_runs", "evidence_refs")
    op.drop_column("fairness_smoke_runs", "target_session_id")
    op.drop_column("fairness_smoke_runs", "request_id")
    op.drop_column("fairness_smoke_runs", "submitted_job_id")
    op.drop_column("fairness_smoke_runs", "created_by")

    op.drop_index("ix_redteam_runs_submitted_job_id", table_name="redteam_runs")
    op.drop_index("ix_redteam_runs_tenant_id", table_name="redteam_runs")
    op.drop_column("redteam_runs", "created_at")
    op.drop_column("redteam_runs", "evidence_refs")
    op.drop_column("redteam_runs", "request_id")
    op.drop_column("redteam_runs", "submitted_job_id")
    op.drop_column("redteam_runs", "created_by")
    op.drop_column("redteam_runs", "tenant_id")
