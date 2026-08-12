"""create trading_journal table

Revision ID: cd56e235c416
Revises: c933df00e111
Create Date: 2026-08-11 16:24:16.142271

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cd56e235c416'
down_revision: Union[str, Sequence[str], None] = 'c933df00e111'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'trading_journal',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('symbol', sa.String(), nullable=False),
        sa.Column('side', sa.String(), nullable=False),
        sa.Column('quantity', sa.Float(), nullable=False),
        sa.Column('entry_price', sa.Float(), nullable=False),
        sa.Column('exit_price', sa.Float(), nullable=True),
        sa.Column('realized_pnl', sa.Float(), nullable=True),
        sa.Column('result', sa.String(), nullable=True),
        sa.Column('notes', sa.String(), nullable=True),
        sa.Column('tags', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True)),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_trading_journal_created_at'), 'trading_journal', ['created_at'], unique=False)
    op.create_index(op.f('ix_trading_journal_symbol'), 'trading_journal', ['symbol'], unique=False)
    op.create_index(op.f('ix_trading_journal_user_id'), 'trading_journal', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_trading_journal_user_id'), table_name='trading_journal')
    op.drop_index(op.f('ix_trading_journal_symbol'), table_name='trading_journal')
    op.drop_index(op.f('ix_trading_journal_created_at'), table_name='trading_journal')
    op.drop_table('trading_journal')
