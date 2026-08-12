"""create_trading_risk_settings_table

Revision ID: a711bd88c999
Revises: f499ec1ff456
Create Date: 2026-08-10 23:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a711bd88c999'
down_revision: Union[str, Sequence[str], None] = 'f499ec1ff456'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'trading_risk_settings',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('broker_id', sa.UUID(), nullable=True),
        sa.Column('max_order_quantity', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('max_order_notional', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('max_position_quantity', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('max_exposure_notional', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('max_orders_per_minute', sa.Integer(), nullable=False),
        sa.Column('daily_loss_limit', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('max_drawdown_percent', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('kill_switch_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['broker_id'], ['brokers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_trading_risk_settings_broker_id'), 'trading_risk_settings', ['broker_id'], unique=False)
    op.create_index(op.f('ix_trading_risk_settings_user_id'), 'trading_risk_settings', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_trading_risk_settings_user_id'), table_name='trading_risk_settings')
    op.drop_index(op.f('ix_trading_risk_settings_broker_id'), table_name='trading_risk_settings')
    op.drop_table('trading_risk_settings')
