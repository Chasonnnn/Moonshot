"""add oral_responses table

Revision ID: 20260310_0015
Revises: 20260307_0014
Create Date: 2026-03-10 05:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260310_0015"
down_revision = "20260307_0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if "oral_responses" not in existing_tables:
        op.create_table(
            "oral_responses",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("session_id", sa.String(length=36), nullable=False),
            sa.Column("question_id", sa.String(length=128), nullable=True),
            sa.Column("clip_type", sa.String(length=64), nullable=False),
            sa.Column("duration_ms", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("mime_type", sa.String(length=128), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False),
            sa.Column("transcript_text", sa.Text(), nullable=False),
            sa.Column("transcription_model", sa.String(length=128), nullable=False),
            sa.Column("request_id", sa.String(length=64), nullable=True),
            sa.Column("audio_retained", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("audio_blob_b64", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )

    indexes = {
        index["name"] for index in inspector.get_indexes("oral_responses")
    } if "oral_responses" in inspector.get_table_names() else set()
    if "ix_oral_responses_session_id" not in indexes:
        op.create_index("ix_oral_responses_session_id", "oral_responses", ["session_id"])
    if "ix_oral_responses_clip_type" not in indexes:
        op.create_index("ix_oral_responses_clip_type", "oral_responses", ["clip_type"])
    if "ix_oral_responses_status" not in indexes:
        op.create_index("ix_oral_responses_status", "oral_responses", ["status"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if "oral_responses" in existing_tables:
        indexes = {index["name"] for index in inspector.get_indexes("oral_responses")}
        if "ix_oral_responses_status" in indexes:
            op.drop_index("ix_oral_responses_status", table_name="oral_responses")
        if "ix_oral_responses_clip_type" in indexes:
            op.drop_index("ix_oral_responses_clip_type", table_name="oral_responses")
        if "ix_oral_responses_session_id" in indexes:
            op.drop_index("ix_oral_responses_session_id", table_name="oral_responses")
        op.drop_table("oral_responses")
