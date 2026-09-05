"""create durable audit events

Revision ID: 20260814040000
Revises: 20260814030000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260814040000"
down_revision: Union[str, Sequence[str], None] = "20260814030000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "audit_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(length=120), nullable=False),
        sa.Column("outcome", sa.String(length=40), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("broker_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("resource_type", sa.String(length=80), nullable=True),
        sa.Column("resource_id", sa.String(length=120), nullable=True),
        sa.Column("details", postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["broker_id"], ["brokers.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_events_action", "audit_events", ["action"])
    op.create_index("ix_audit_events_outcome", "audit_events", ["outcome"])
    op.create_index("ix_audit_events_user_id", "audit_events", ["user_id"])
    op.create_index("ix_audit_events_broker_id", "audit_events", ["broker_id"])
    op.create_index("ix_audit_events_resource_type", "audit_events", ["resource_type"])
    op.create_index("ix_audit_events_resource_id", "audit_events", ["resource_id"])
    op.create_index("ix_audit_events_occurred_at", "audit_events", ["occurred_at"])
    op.create_index("ix_audit_events_occurred_action", "audit_events", ["occurred_at", "action"])
    op.create_index("ix_audit_events_user_occurred", "audit_events", ["user_id", "occurred_at"])


def downgrade() -> None:
    op.drop_index("ix_audit_events_user_occurred", table_name="audit_events")
    op.drop_index("ix_audit_events_occurred_action", table_name="audit_events")
    for name in ["ix_audit_events_occurred_at", "ix_audit_events_resource_id", "ix_audit_events_resource_type", "ix_audit_events_broker_id", "ix_audit_events_user_id", "ix_audit_events_outcome", "ix_audit_events_action"]:
        op.drop_index(name, table_name="audit_events")
    op.drop_table("audit_events")
