"""create broker order ledger

Revision ID: 20260814000000
Revises: 20260811230000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260814000000"
down_revision = "20260811230000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "broker_order_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("broker_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("broker_order_id", sa.String(length=255), nullable=False),
        sa.Column("strategy_instance_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("signal_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("symbol", sa.String(length=100), nullable=False),
        sa.Column("exchange", sa.String(length=30), nullable=True),
        sa.Column("side", sa.String(length=10), nullable=False),
        sa.Column("quantity", sa.Numeric(20, 8), nullable=False),
        sa.Column("filled_quantity", sa.Numeric(20, 8), nullable=False, server_default="0"),
        sa.Column("average_fill_price", sa.Numeric(20, 8), nullable=True),
        sa.Column("order_type", sa.String(length=30), nullable=True),
        sa.Column("product", sa.String(length=30), nullable=True),
        sa.Column("variety", sa.String(length=30), nullable=True),
        sa.Column("price", sa.Numeric(20, 8), nullable=True),
        sa.Column("trigger_price", sa.Numeric(20, 8), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("last_broker_sync_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("broker_created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("broker_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("raw_payload", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["broker_id"], ["brokers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["strategy_instance_id"], ["strategy_instances.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["signal_id"], ["strategy_signals.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("broker_id", "broker_order_id", name="uq_broker_order_records_broker_order"),
    )
    for column in ["user_id", "broker_id", "strategy_instance_id", "signal_id", "symbol", "status", "last_broker_sync_at"]:
        op.create_index(f"ix_broker_order_records_{column}", "broker_order_records", [column], unique=False)


def downgrade() -> None:
    for column in ["last_broker_sync_at", "status", "symbol", "signal_id", "strategy_instance_id", "broker_id", "user_id"]:
        op.drop_index(f"ix_broker_order_records_{column}", table_name="broker_order_records")
    op.drop_table("broker_order_records")
