"""create_strategy_engine_tables

Revision ID: b822ce99d000
Revises: a711bd88c999
Create Date: 2026-08-10 23:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b822ce99d000'
down_revision: Union[str, Sequence[str], None] = 'a711bd88c999'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'strategy_definitions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('strategy_type', sa.String(length=64), nullable=False),
        sa.Column('config_json', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_strategy_definitions_user_id'), 'strategy_definitions', ['user_id'], unique=False)

    op.create_table(
        'strategy_instances',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('strategy_definition_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('broker_id', sa.UUID(), nullable=False),
        sa.Column('execution_mode', sa.String(length=32), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('stopped_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_execution_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['broker_id'], ['brokers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['strategy_definition_id'], ['strategy_definitions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_strategy_instances_broker_id'), 'strategy_instances', ['broker_id'], unique=False)
    op.create_index(op.f('ix_strategy_instances_strategy_definition_id'), 'strategy_instances', ['strategy_definition_id'], unique=False)
    op.create_index(op.f('ix_strategy_instances_user_id'), 'strategy_instances', ['user_id'], unique=False)

    op.create_table(
        'strategy_signals',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('strategy_instance_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('broker_id', sa.UUID(), nullable=False),
        sa.Column('symbol', sa.String(length=64), nullable=False),
        sa.Column('side', sa.String(length=16), nullable=False),
        sa.Column('quantity', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('order_type', sa.String(length=32), nullable=False),
        sa.Column('price', sa.Numeric(precision=18, scale=4), nullable=True),
        sa.Column('signal_fingerprint', sa.String(length=64), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['broker_id'], ['brokers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['strategy_instance_id'], ['strategy_instances.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('strategy_instance_id', 'signal_fingerprint', name='uq_strategy_instance_signal_fingerprint')
    )
    op.create_index(op.f('ix_strategy_signals_broker_id'), 'strategy_signals', ['broker_id'], unique=False)
    op.create_index(op.f('ix_strategy_signals_signal_fingerprint'), 'strategy_signals', ['signal_fingerprint'], unique=False)
    op.create_index(op.f('ix_strategy_signals_strategy_instance_id'), 'strategy_signals', ['strategy_instance_id'], unique=False)
    op.create_index(op.f('ix_strategy_signals_user_id'), 'strategy_signals', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('strategy_signals')
    op.drop_table('strategy_instances')
    op.drop_table('strategy_definitions')
