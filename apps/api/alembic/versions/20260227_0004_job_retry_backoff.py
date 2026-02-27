"""add next_attempt_at for job retry backoff

Revision ID: 20260227_0004
Revises: 20260227_0003
Create Date: 2026-02-27 23:55:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260227_0004"
down_revision = "20260227_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("job_runs", sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_job_runs_next_attempt_at", "job_runs", ["next_attempt_at"])


def downgrade() -> None:
    op.drop_index("ix_job_runs_next_attempt_at", table_name="job_runs")
    op.drop_column("job_runs", "next_attempt_at")
