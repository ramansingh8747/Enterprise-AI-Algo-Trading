"""create strategy import drafts

Revision ID: 20260815000000
Revises: 20260814040000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260815000000"
down_revision: Union[str, Sequence[str], None] = "20260814040000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "strategy_imports",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("stored_filename", sa.String(length=255), nullable=False),
        sa.Column("file_type", sa.String(length=32), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=False),
        sa.Column("extracted_text", sa.Text(), nullable=True),
        sa.Column("extracted_config", postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column("warnings", postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("strategy_definition_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["strategy_definition_id"], ["strategy_definitions.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("stored_filename"),
    )
    op.create_index("ix_strategy_imports_user_id", "strategy_imports", ["user_id"])
    op.create_index("ix_strategy_imports_strategy_definition_id", "strategy_imports", ["strategy_definition_id"])


def downgrade() -> None:
    op.drop_index("ix_strategy_imports_strategy_definition_id", table_name="strategy_imports")
    op.drop_index("ix_strategy_imports_user_id", table_name="strategy_imports")
    op.drop_table("strategy_imports")
