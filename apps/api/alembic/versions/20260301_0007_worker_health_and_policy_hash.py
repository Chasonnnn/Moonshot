"""add worker heartbeat table and policy hash trace field

Revision ID: 20260301_0007
Revises: 20260228_0006
Create Date: 2026-03-01 00:35:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260301_0007"
down_revision = "20260228_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("context_injection_traces", sa.Column("policy_hash", sa.String(length=64), nullable=True))

    op.create_table(
        "worker_heartbeats",
        sa.Column("worker_id", sa.String(length=100), primary_key=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_job_id", sa.String(length=36), nullable=True),
    )
    op.create_index("ix_worker_heartbeats_last_seen_at", "worker_heartbeats", ["last_seen_at"])


def downgrade() -> None:
    op.drop_index("ix_worker_heartbeats_last_seen_at", table_name="worker_heartbeats")
    op.drop_table("worker_heartbeats")
    op.drop_column("context_injection_traces", "policy_hash")
