"""add case_datasets and deliverables tables

Revision ID: 20260305_0013
Revises: 20260305_0012
Create Date: 2026-03-05 14:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260305_0013"
down_revision = "20260305_0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if "case_datasets" not in existing_tables:
        op.create_table(
            "case_datasets",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("case_id", sa.String(length=36), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("description", sa.Text(), nullable=False),
            sa.Column("row_count", sa.Integer(), nullable=False),
            sa.Column("file_path", sa.String(length=512), nullable=False),
            sa.Column("schema_json", sa.JSON(), nullable=False),
            sa.Column("precomputed_queries", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )

    indexes = {
        index["name"] for index in inspector.get_indexes("case_datasets")
    } if "case_datasets" in inspector.get_table_names() else set()
    if "ix_case_datasets_case_id" not in indexes:
        op.create_index("ix_case_datasets_case_id", "case_datasets", ["case_id"])

    if "deliverables" not in existing_tables:
        op.create_table(
            "deliverables",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("session_id", sa.String(length=36), nullable=False),
            sa.Column("part_id", sa.String(length=36), nullable=True),
            sa.Column("content_markdown", sa.Text(), nullable=False),
            sa.Column("embedded_artifacts", sa.JSON(), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )

    indexes = {
        index["name"] for index in inspector.get_indexes("deliverables")
    } if "deliverables" in inspector.get_table_names() else set()
    if "ix_deliverables_session_id" not in indexes:
        op.create_index("ix_deliverables_session_id", "deliverables", ["session_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if "deliverables" in existing_tables:
        indexes = {index["name"] for index in inspector.get_indexes("deliverables")}
        if "ix_deliverables_session_id" in indexes:
            op.drop_index("ix_deliverables_session_id", table_name="deliverables")
        op.drop_table("deliverables")

    if "case_datasets" in existing_tables:
        indexes = {index["name"] for index in inspector.get_indexes("case_datasets")}
        if "ix_case_datasets_case_id" in indexes:
            op.drop_index("ix_case_datasets_case_id", table_name="case_datasets")
        op.drop_table("case_datasets")
