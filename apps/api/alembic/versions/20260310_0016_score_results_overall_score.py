"""add overall_score to score_results

Revision ID: 20260310_0016
Revises: 20260310_0015
Create Date: 2026-03-10 05:35:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260310_0016"
down_revision = "20260310_0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("score_results")}

    if "overall_score" not in columns:
        op.add_column("score_results", sa.Column("overall_score", sa.Float(), nullable=True))
        op.execute("UPDATE score_results SET overall_score = confidence WHERE overall_score IS NULL")
        op.alter_column("score_results", "overall_score", nullable=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("score_results")}

    if "overall_score" in columns:
        op.drop_column("score_results", "overall_score")
