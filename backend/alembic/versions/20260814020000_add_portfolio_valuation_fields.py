"""add application portfolio valuation fields

Revision ID: 20260814020000
Revises: 20260814010000
"""
from alembic import op
import sqlalchemy as sa

revision = "20260814020000"
down_revision = "20260814010000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("trading_positions", sa.Column("last_price", sa.Numeric(20, 8), nullable=True))
    op.add_column("trading_positions", sa.Column("market_value", sa.Numeric(20, 8), nullable=False, server_default="0"))
    op.add_column("trading_positions", sa.Column("unrealized_pnl", sa.Numeric(20, 8), nullable=False, server_default="0"))
    op.add_column("trading_positions", sa.Column("valuation_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("paper_positions", sa.Column("last_price", sa.Numeric(18, 4), nullable=True))
    op.add_column("paper_positions", sa.Column("market_value", sa.Numeric(18, 4), nullable=False, server_default="0.0000"))
    op.add_column("paper_positions", sa.Column("valuation_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("paper_positions", "valuation_at")
    op.drop_column("paper_positions", "market_value")
    op.drop_column("paper_positions", "last_price")
    op.drop_column("trading_positions", "valuation_at")
    op.drop_column("trading_positions", "unrealized_pnl")
    op.drop_column("trading_positions", "market_value")
    op.drop_column("trading_positions", "last_price")
