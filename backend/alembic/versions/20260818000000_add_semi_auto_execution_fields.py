"""add semi auto execution fields, stop loss and order sources

Revision ID: 20260818000000
Revises: 20260815000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260818000000"
down_revision: Union[str, Sequence[str], None] = "20260815000000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # strategy_signals
    op.add_column("strategy_signals", sa.Column("suggested_quantity", sa.Numeric(18, 4), nullable=True))
    op.add_column("strategy_signals", sa.Column("actual_quantity", sa.Numeric(18, 4), nullable=True))
    op.add_column("strategy_signals", sa.Column("stop_loss", sa.Numeric(18, 4), nullable=True))
    op.add_column("strategy_signals", sa.Column("target", sa.Numeric(18, 4), nullable=True))
    op.add_column("strategy_signals", sa.Column("risk_reward", sa.String(32), nullable=True))
    op.add_column("strategy_signals", sa.Column("reason", sa.Text(), nullable=True))
    op.add_column("strategy_signals", sa.Column("indicators_json", sa.Text(), nullable=True))
    op.add_column("strategy_signals", sa.Column("executed_order_id", sa.String(255), nullable=True))
    op.add_column("strategy_signals", sa.Column("actioned_at", sa.DateTime(timezone=True), nullable=True))

    # trading_positions
    op.add_column("trading_positions", sa.Column("stop_loss", sa.Numeric(20, 8), nullable=True))
    op.add_column("trading_positions", sa.Column("target", sa.Numeric(20, 8), nullable=True))
    op.add_column("trading_positions", sa.Column("status", sa.String(32), server_default="OPEN", nullable=False))
    op.add_column("trading_positions", sa.Column("source", sa.String(32), nullable=True))

    # trading_executions
    op.add_column("trading_executions", sa.Column("order_source", sa.String(32), server_default="MANUAL_BUY", nullable=True))

    # paper_positions
    op.add_column("paper_positions", sa.Column("stop_loss", sa.Numeric(18, 4), nullable=True))
    op.add_column("paper_positions", sa.Column("target", sa.Numeric(18, 4), nullable=True))
    op.add_column("paper_positions", sa.Column("status", sa.String(32), server_default="OPEN", nullable=False))

    # broker_order_records
    op.add_column("broker_order_records", sa.Column("order_source", sa.String(32), server_default="MANUAL_BUY", nullable=True))

    # alerts
    op.add_column("alerts", sa.Column("signal_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("alerts", sa.Column("data_json", sa.String(), nullable=True))
    op.create_foreign_key("fk_alerts_signal_id", "alerts", "strategy_signals", ["signal_id"], ["id"], ondelete="SET NULL")
    op.create_index(op.f("ix_alerts_signal_id"), "alerts", ["signal_id"], unique=False)


def downgrade() -> None:
    op.drop_constraint("fk_alerts_signal_id", "alerts", type_="foreignkey")
    op.drop_index(op.f("ix_alerts_signal_id"), table_name="alerts")
    op.drop_column("alerts", "data_json")
    op.drop_column("alerts", "signal_id")

    op.drop_column("broker_order_records", "order_source")

    op.drop_column("paper_positions", "status")
    op.drop_column("paper_positions", "target")
    op.drop_column("paper_positions", "stop_loss")

    op.drop_column("trading_executions", "order_source")

    op.drop_column("trading_positions", "source")
    op.drop_column("trading_positions", "status")
    op.drop_column("trading_positions", "target")
    op.drop_column("trading_positions", "stop_loss")

    op.drop_column("strategy_signals", "actioned_at")
    op.drop_column("strategy_signals", "executed_order_id")
    op.drop_column("strategy_signals", "indicators_json")
    op.drop_column("strategy_signals", "reason")
    op.drop_column("strategy_signals", "risk_reward")
    op.drop_column("strategy_signals", "target")
    op.drop_column("strategy_signals", "stop_loss")
    op.drop_column("strategy_signals", "actual_quantity")
    op.drop_column("strategy_signals", "suggested_quantity")
