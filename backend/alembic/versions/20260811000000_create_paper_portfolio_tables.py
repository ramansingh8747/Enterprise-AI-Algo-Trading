"""create_paper_portfolio_tables

Revision ID: c933df00e111
Revises: b822ce99d000
Create Date: 2026-08-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c933df00e111'
down_revision: Union[str, Sequence[str], None] = 'b822ce99d000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'paper_portfolios',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('strategy_instance_id', sa.UUID(), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('execution_mode', sa.String(length=32), nullable=False),
        sa.Column('currency', sa.String(length=8), nullable=False),
        sa.Column('initial_balance', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('cash_balance', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('realized_pnl', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['strategy_instance_id'], ['strategy_instances.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_paper_portfolios_strategy_instance_id'), 'paper_portfolios', ['strategy_instance_id'], unique=False)
    op.create_index(op.f('ix_paper_portfolios_user_id'), 'paper_portfolios', ['user_id'], unique=False)

    op.create_table(
        'paper_positions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('paper_portfolio_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('strategy_instance_id', sa.UUID(), nullable=True),
        sa.Column('symbol', sa.String(length=64), nullable=False),
        sa.Column('quantity', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('average_price', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('cost_basis', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('realized_pnl', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('unrealized_pnl', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['paper_portfolio_id'], ['paper_portfolios.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['strategy_instance_id'], ['strategy_instances.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('paper_portfolio_id', 'symbol', name='uq_paper_portfolio_symbol')
    )
    op.create_index(op.f('ix_paper_positions_paper_portfolio_id'), 'paper_positions', ['paper_portfolio_id'], unique=False)
    op.create_index(op.f('ix_paper_positions_strategy_instance_id'), 'paper_positions', ['strategy_instance_id'], unique=False)
    op.create_index(op.f('ix_paper_positions_symbol'), 'paper_positions', ['symbol'], unique=False)
    op.create_index(op.f('ix_paper_positions_user_id'), 'paper_positions', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('paper_positions')
    op.drop_table('paper_portfolios')
