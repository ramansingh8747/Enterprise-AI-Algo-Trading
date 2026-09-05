"""create execution ledger and live positions

Revision ID: 20260814010000
Revises: 20260814000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260814010000"
down_revision = "20260814000000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "trading_executions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("broker_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("broker_order_record_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("strategy_instance_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("signal_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("execution_mode", sa.String(length=16), nullable=False),
        sa.Column("external_execution_id", sa.String(length=255), nullable=False),
        sa.Column("symbol", sa.String(length=100), nullable=False),
        sa.Column("side", sa.String(length=10), nullable=False),
        sa.Column("quantity", sa.Numeric(20, 8), nullable=False),
        sa.Column("price", sa.Numeric(20, 8), nullable=False),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["broker_id"], ["brokers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["broker_order_record_id"], ["broker_order_records.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["strategy_instance_id"], ["strategy_instances.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["signal_id"], ["strategy_signals.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("execution_mode", "broker_id", "external_execution_id", name="uq_trading_execution_external"),
    )
    for column in ["user_id", "broker_id", "broker_order_record_id", "strategy_instance_id", "signal_id", "execution_mode", "symbol", "executed_at"]:
        op.create_index(f"ix_trading_executions_{column}", "trading_executions", [column], unique=False)

    op.create_table(
        "trading_positions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("broker_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("strategy_instance_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("symbol", sa.String(length=100), nullable=False),
        sa.Column("quantity", sa.Numeric(20, 8), nullable=False, server_default="0"),
        sa.Column("average_price", sa.Numeric(20, 8), nullable=False, server_default="0"),
        sa.Column("realized_pnl", sa.Numeric(20, 8), nullable=False, server_default="0"),
        sa.Column("last_execution_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["broker_id"], ["brokers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["strategy_instance_id"], ["strategy_instances.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "broker_id", "symbol", name="uq_trading_position_account_symbol"),
    )
    for column in ["user_id", "broker_id", "strategy_instance_id", "symbol"]:
        op.create_index(f"ix_trading_positions_{column}", "trading_positions", [column], unique=False)


def downgrade() -> None:
    for column in ["symbol", "strategy_instance_id", "broker_id", "user_id"]:
        op.drop_index(f"ix_trading_positions_{column}", table_name="trading_positions")
    op.drop_table("trading_positions")
    for column in ["executed_at", "symbol", "execution_mode", "signal_id", "strategy_instance_id", "broker_order_record_id", "broker_id", "user_id"]:
        op.drop_index(f"ix_trading_executions_{column}", table_name="trading_executions")
    op.drop_table("trading_executions")
