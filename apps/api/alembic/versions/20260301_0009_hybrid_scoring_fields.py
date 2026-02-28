"""add hybrid scoring persistence fields

Revision ID: 20260301_0009
Revises: 20260301_0008
Create Date: 2026-03-01 12:40:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260301_0009"
down_revision = "20260301_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("task_families", sa.Column("scoring_config", sa.JSON(), nullable=True))
    op.execute("UPDATE task_families SET scoring_config='{}' WHERE scoring_config IS NULL")
    op.alter_column("task_families", "scoring_config", nullable=False)

    op.add_column("score_results", sa.Column("llm_traces", sa.JSON(), nullable=True))
    op.add_column("score_results", sa.Column("dimension_evidence", sa.JSON(), nullable=True))
    op.execute("UPDATE score_results SET llm_traces='[]' WHERE llm_traces IS NULL")
    op.execute("UPDATE score_results SET dimension_evidence='{}' WHERE dimension_evidence IS NULL")
    op.alter_column("score_results", "llm_traces", nullable=False)
    op.alter_column("score_results", "dimension_evidence", nullable=False)


def downgrade() -> None:
    op.drop_column("score_results", "dimension_evidence")
    op.drop_column("score_results", "llm_traces")
    op.drop_column("task_families", "scoring_config")
