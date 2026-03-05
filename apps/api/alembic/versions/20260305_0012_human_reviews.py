"""add human reviews table

Revision ID: 20260305_0012
Revises: 20260302_0011
Create Date: 2026-03-05 11:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260305_0012"
down_revision = "20260302_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    table_created = "human_reviews" not in inspector.get_table_names()
    if table_created:
        op.create_table(
            "human_reviews",
            sa.Column("session_id", sa.String(length=36), primary_key=True),
            sa.Column("tenant_id", sa.String(length=100), nullable=False),
            sa.Column("notes_markdown", sa.Text(), nullable=True),
            sa.Column("tags", sa.JSON(), nullable=False),
            sa.Column("override_overall_score", sa.Float(), nullable=True),
            sa.Column("override_confidence", sa.Float(), nullable=True),
            sa.Column("dimension_overrides", sa.JSON(), nullable=False),
            sa.Column("reviewer_id", sa.String(length=100), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )

    indexes = {
        index["name"] for index in inspector.get_indexes("human_reviews")
    } if "human_reviews" in inspector.get_table_names() else set()
    if "ix_human_reviews_tenant_id" not in indexes:
        op.create_index("ix_human_reviews_tenant_id", "human_reviews", ["tenant_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "human_reviews" not in inspector.get_table_names():
        return

    indexes = {index["name"] for index in inspector.get_indexes("human_reviews")}
    if "ix_human_reviews_tenant_id" in indexes:
        op.drop_index("ix_human_reviews_tenant_id", table_name="human_reviews")
    op.drop_table("human_reviews")
