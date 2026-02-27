"""add worker lease fields and audit hash chain fields

Revision ID: 20260228_0005
Revises: 20260227_0004
Create Date: 2026-02-28 10:10:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260228_0005"
down_revision = "20260227_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("job_runs", sa.Column("lease_owner", sa.String(length=100), nullable=True))
    op.add_column("job_runs", sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_job_runs_lease_expires_at", "job_runs", ["lease_expires_at"])

    op.add_column("audit_logs", sa.Column("prev_hash", sa.String(length=64), nullable=True))
    op.add_column("audit_logs", sa.Column("entry_hash", sa.String(length=64), nullable=True))
    op.create_index("ix_audit_logs_entry_hash", "audit_logs", ["entry_hash"])

    op.execute("UPDATE audit_logs SET prev_hash='GENESIS' WHERE prev_hash IS NULL")
    op.execute("UPDATE audit_logs SET entry_hash='MIGRATED' WHERE entry_hash IS NULL")
    op.alter_column("audit_logs", "prev_hash", nullable=False)
    op.alter_column("audit_logs", "entry_hash", nullable=False)


def downgrade() -> None:
    op.drop_index("ix_audit_logs_entry_hash", table_name="audit_logs")
    op.drop_column("audit_logs", "entry_hash")
    op.drop_column("audit_logs", "prev_hash")

    op.drop_index("ix_job_runs_lease_expires_at", table_name="job_runs")
    op.drop_column("job_runs", "lease_expires_at")
    op.drop_column("job_runs", "lease_owner")
