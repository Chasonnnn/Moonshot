"""add session python history table

Revision ID: 20260302_0011
Revises: 20260301_0010
Create Date: 2026-03-02 10:30:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260302_0011"
down_revision = "20260301_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_created = "session_python_history" not in inspector.get_table_names()
    if table_created:
        op.create_table(
            "session_python_history",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("session_id", sa.String(length=36), nullable=False),
            sa.Column("item", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
    if table_created:
        op.create_index("ix_session_python_history_session_id", "session_python_history", ["session_id"])
        return

    indexes = {index["name"] for index in inspector.get_indexes("session_python_history")}
    if "ix_session_python_history_session_id" not in indexes:
        op.create_index("ix_session_python_history_session_id", "session_python_history", ["session_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "session_python_history" not in inspector.get_table_names():
        return
    indexes = {index["name"] for index in inspector.get_indexes("session_python_history")}
    if "ix_session_python_history_session_id" in indexes:
        op.drop_index("ix_session_python_history_session_id", table_name="session_python_history")
    op.drop_table("session_python_history")
