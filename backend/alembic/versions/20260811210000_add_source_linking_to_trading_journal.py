"""add source linking to trading_journal

Revision ID: 20260811210000
Revises: cd56e235c416
Create Date: 2026-08-11 21:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260811210000'
down_revision: Union[str, Sequence[str], None] = 'cd56e235c416'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('trading_journal', sa.Column('paper_trade_id', sa.String(), nullable=True))
    op.add_column('trading_journal', sa.Column('broker_order_id', sa.String(), nullable=True))
    op.add_column('trading_journal', sa.Column('strategy_instance_id', sa.UUID(), nullable=True))
    op.add_column('trading_journal', sa.Column('strategy_signal_id', sa.UUID(), nullable=True))

    op.create_index(op.f('ix_trading_journal_paper_trade_id'), 'trading_journal', ['paper_trade_id'], unique=False)
    op.create_index(op.f('ix_trading_journal_broker_order_id'), 'trading_journal', ['broker_order_id'], unique=False)
    op.create_index(op.f('ix_trading_journal_strategy_instance_id'), 'trading_journal', ['strategy_instance_id'], unique=False)
    op.create_index(op.f('ix_trading_journal_strategy_signal_id'), 'trading_journal', ['strategy_signal_id'], unique=False)

    op.create_foreign_key(
        'fk_trading_journal_strategy_instance_id',
        'trading_journal', 'strategy_instances',
        ['strategy_instance_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_foreign_key(
        'fk_trading_journal_strategy_signal_id',
        'trading_journal', 'strategy_signals',
        ['strategy_signal_id'], ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_trading_journal_strategy_signal_id', 'trading_journal', type_='foreignkey')
    op.drop_constraint('fk_trading_journal_strategy_instance_id', 'trading_journal', type_='foreignkey')

    op.drop_index(op.f('ix_trading_journal_strategy_signal_id'), table_name='trading_journal')
    op.drop_index(op.f('ix_trading_journal_strategy_instance_id'), table_name='trading_journal')
    op.drop_index(op.f('ix_trading_journal_broker_order_id'), table_name='trading_journal')
    op.drop_index(op.f('ix_trading_journal_paper_trade_id'), table_name='trading_journal')

    op.drop_column('trading_journal', 'strategy_signal_id')
    op.drop_column('trading_journal', 'strategy_instance_id')
    op.drop_column('trading_journal', 'broker_order_id')
    op.drop_column('trading_journal', 'paper_trade_id')
