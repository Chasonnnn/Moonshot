"""add generation diagnostics and scoring detail fields

Revision ID: 20260301_0008
Revises: 20260301_0007
Create Date: 2026-03-01 02:40:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260301_0008"
down_revision = "20260301_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("task_families", sa.Column("generation_diagnostics", sa.JSON(), nullable=True))
    op.execute("UPDATE task_families SET generation_diagnostics='{}' WHERE generation_diagnostics IS NULL")
    op.alter_column("task_families", "generation_diagnostics", nullable=False)

    op.add_column("score_results", sa.Column("trigger_codes", sa.JSON(), nullable=True))
    op.add_column("score_results", sa.Column("trigger_impacts", sa.JSON(), nullable=True))
    op.add_column("score_results", sa.Column("scored_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("UPDATE score_results SET trigger_codes='[]' WHERE trigger_codes IS NULL")
    op.execute("UPDATE score_results SET trigger_impacts='[]' WHERE trigger_impacts IS NULL")
    op.execute("UPDATE score_results SET scored_at=NOW() WHERE scored_at IS NULL")
    op.alter_column("score_results", "trigger_codes", nullable=False)
    op.alter_column("score_results", "trigger_impacts", nullable=False)
    op.alter_column("score_results", "scored_at", nullable=False)

    op.add_column("task_quality_signals", sa.Column("diversity_fail_reason", sa.String(length=128), nullable=True))
    op.add_column("task_quality_signals", sa.Column("leakage_rule_hits", sa.JSON(), nullable=True))
    op.add_column("task_quality_signals", sa.Column("grounding_coverage_score", sa.Float(), nullable=True))
    op.execute("UPDATE task_quality_signals SET leakage_rule_hits='[]' WHERE leakage_rule_hits IS NULL")
    op.execute("UPDATE task_quality_signals SET grounding_coverage_score=0.0 WHERE grounding_coverage_score IS NULL")
    op.alter_column("task_quality_signals", "leakage_rule_hits", nullable=False)
    op.alter_column("task_quality_signals", "grounding_coverage_score", nullable=False)


def downgrade() -> None:
    op.drop_column("task_quality_signals", "grounding_coverage_score")
    op.drop_column("task_quality_signals", "leakage_rule_hits")
    op.drop_column("task_quality_signals", "diversity_fail_reason")

    op.drop_column("score_results", "scored_at")
    op.drop_column("score_results", "trigger_impacts")
    op.drop_column("score_results", "trigger_codes")

    op.drop_column("task_families", "generation_diagnostics")
