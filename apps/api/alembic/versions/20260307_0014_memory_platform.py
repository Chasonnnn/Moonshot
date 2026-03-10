"""add memory platform tables and trace fields

Revision ID: 20260307_0014
Revises: 20260305_0013
Create Date: 2026-03-07 12:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260307_0014"
down_revision = "20260305_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if "memory_entries" not in existing_tables:
        op.create_table(
            "memory_entries",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("tenant_id", sa.String(length=100), nullable=False),
            sa.Column("layer", sa.String(length=32), nullable=False),
            sa.Column("source_entity_type", sa.String(length=64), nullable=False),
            sa.Column("source_entity_id", sa.String(length=64), nullable=False),
            sa.Column("source_type", sa.String(length=32), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False),
            sa.Column("visibility_scope", sa.JSON(), nullable=False),
            sa.Column("created_by", sa.String(length=100), nullable=True),
            sa.Column("reviewed_by", sa.String(length=100), nullable=True),
            sa.Column("policy_version", sa.String(length=32), nullable=True),
            sa.Column("change_reason", sa.Text(), nullable=True),
            sa.Column("text_content", sa.Text(), nullable=False),
            sa.Column("metadata_json", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )

    indexes = {
        index["name"] for index in inspector.get_indexes("memory_entries")
    } if "memory_entries" in inspector.get_table_names() else set()
    if "ix_memory_entries_tenant_id" not in indexes:
        op.create_index("ix_memory_entries_tenant_id", "memory_entries", ["tenant_id"])
    if "ix_memory_entries_layer" not in indexes:
        op.create_index("ix_memory_entries_layer", "memory_entries", ["layer"])
    if "ix_memory_entries_source_entity_type" not in indexes:
        op.create_index("ix_memory_entries_source_entity_type", "memory_entries", ["source_entity_type"])
    if "ix_memory_entries_source_entity_id" not in indexes:
        op.create_index("ix_memory_entries_source_entity_id", "memory_entries", ["source_entity_id"])
    if "ix_memory_entries_status" not in indexes:
        op.create_index("ix_memory_entries_status", "memory_entries", ["status"])

    if "memory_chunks" not in existing_tables:
        op.create_table(
            "memory_chunks",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("memory_entry_id", sa.String(length=36), nullable=False),
            sa.Column("tenant_id", sa.String(length=100), nullable=False),
            sa.Column("chunk_index", sa.Integer(), nullable=False),
            sa.Column("text_content", sa.Text(), nullable=False),
            sa.Column("metadata_json", sa.JSON(), nullable=False),
            sa.Column("fts_document", sa.Text(), nullable=False),
            sa.Column("embedding", sa.JSON(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )

    indexes = {
        index["name"] for index in inspector.get_indexes("memory_chunks")
    } if "memory_chunks" in inspector.get_table_names() else set()
    if "ix_memory_chunks_memory_entry_id" not in indexes:
        op.create_index("ix_memory_chunks_memory_entry_id", "memory_chunks", ["memory_entry_id"])
    if "ix_memory_chunks_tenant_id" not in indexes:
        op.create_index("ix_memory_chunks_tenant_id", "memory_chunks", ["tenant_id"])

    if "session_memory_digests" not in existing_tables:
        op.create_table(
            "session_memory_digests",
            sa.Column("session_id", sa.String(length=36), primary_key=True),
            sa.Column("tenant_id", sa.String(length=100), nullable=False),
            sa.Column("summary_text", sa.Text(), nullable=False),
            sa.Column("facts_json", sa.JSON(), nullable=False),
            sa.Column("risk_signals", sa.JSON(), nullable=False),
            sa.Column("open_questions", sa.JSON(), nullable=False),
            sa.Column("last_event_offset", sa.Integer(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )

    indexes = {
        index["name"] for index in inspector.get_indexes("session_memory_digests")
    } if "session_memory_digests" in inspector.get_table_names() else set()
    if "ix_session_memory_digests_tenant_id" not in indexes:
        op.create_index("ix_session_memory_digests_tenant_id", "session_memory_digests", ["tenant_id"])

    existing_columns = {
        column["name"] for column in inspector.get_columns("context_injection_traces")
    } if "context_injection_traces" in existing_tables else set()
    if "memory_entry_ids" not in existing_columns:
        op.add_column("context_injection_traces", sa.Column("memory_entry_ids", sa.JSON(), nullable=False, server_default="[]"))
    if "chunk_ids" not in existing_columns:
        op.add_column("context_injection_traces", sa.Column("chunk_ids", sa.JSON(), nullable=False, server_default="[]"))
    if "ranking_features" not in existing_columns:
        op.add_column("context_injection_traces", sa.Column("ranking_features", sa.JSON(), nullable=False, server_default="{}"))
    if "query_text" not in existing_columns:
        op.add_column("context_injection_traces", sa.Column("query_text", sa.Text(), nullable=True))
    if "token_budget" not in existing_columns:
        op.add_column("context_injection_traces", sa.Column("token_budget", sa.Integer(), nullable=True))
    if "assembled_context_hash" not in existing_columns:
        op.add_column("context_injection_traces", sa.Column("assembled_context_hash", sa.String(length=64), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if "context_injection_traces" in existing_tables:
        existing_columns = {column["name"] for column in inspector.get_columns("context_injection_traces")}
        if "assembled_context_hash" in existing_columns:
            op.drop_column("context_injection_traces", "assembled_context_hash")
        if "token_budget" in existing_columns:
            op.drop_column("context_injection_traces", "token_budget")
        if "query_text" in existing_columns:
            op.drop_column("context_injection_traces", "query_text")
        if "ranking_features" in existing_columns:
            op.drop_column("context_injection_traces", "ranking_features")
        if "chunk_ids" in existing_columns:
            op.drop_column("context_injection_traces", "chunk_ids")
        if "memory_entry_ids" in existing_columns:
            op.drop_column("context_injection_traces", "memory_entry_ids")

    if "session_memory_digests" in existing_tables:
        indexes = {index["name"] for index in inspector.get_indexes("session_memory_digests")}
        if "ix_session_memory_digests_tenant_id" in indexes:
            op.drop_index("ix_session_memory_digests_tenant_id", table_name="session_memory_digests")
        op.drop_table("session_memory_digests")

    if "memory_chunks" in existing_tables:
        indexes = {index["name"] for index in inspector.get_indexes("memory_chunks")}
        if "ix_memory_chunks_tenant_id" in indexes:
            op.drop_index("ix_memory_chunks_tenant_id", table_name="memory_chunks")
        if "ix_memory_chunks_memory_entry_id" in indexes:
            op.drop_index("ix_memory_chunks_memory_entry_id", table_name="memory_chunks")
        op.drop_table("memory_chunks")

    if "memory_entries" in existing_tables:
        indexes = {index["name"] for index in inspector.get_indexes("memory_entries")}
        if "ix_memory_entries_status" in indexes:
            op.drop_index("ix_memory_entries_status", table_name="memory_entries")
        if "ix_memory_entries_source_entity_id" in indexes:
            op.drop_index("ix_memory_entries_source_entity_id", table_name="memory_entries")
        if "ix_memory_entries_source_entity_type" in indexes:
            op.drop_index("ix_memory_entries_source_entity_type", table_name="memory_entries")
        if "ix_memory_entries_layer" in indexes:
            op.drop_index("ix_memory_entries_layer", table_name="memory_entries")
        if "ix_memory_entries_tenant_id" in indexes:
            op.drop_index("ix_memory_entries_tenant_id", table_name="memory_entries")
        op.drop_table("memory_entries")
