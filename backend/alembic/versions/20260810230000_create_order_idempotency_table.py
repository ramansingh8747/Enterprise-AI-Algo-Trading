"""create_order_idempotency_table

Revision ID: f499ec1ff456
Revises: e388db0ee329
Create Date: 2026-08-10 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f499ec1ff456'
down_revision: Union[str, Sequence[str], None] = 'e388db0ee329'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'order_idempotency_records',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('broker_id', sa.UUID(), nullable=False),
        sa.Column('idempotency_key', sa.String(length=255), nullable=False),
        sa.Column('request_hash', sa.String(length=64), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False),
        sa.Column('order_id', sa.String(length=255), nullable=True),
        sa.Column('response_payload', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['broker_id'], ['brokers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'broker_id', 'idempotency_key', name='uq_user_broker_idempotency_key')
    )
    op.create_index(op.f('ix_order_idempotency_records_broker_id'), 'order_idempotency_records', ['broker_id'], unique=False)
    op.create_index(op.f('ix_order_idempotency_records_user_id'), 'order_idempotency_records', ['user_id'], unique=False)
    op.create_index(op.f('ix_order_idempotency_records_idempotency_key'), 'order_idempotency_records', ['idempotency_key'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_order_idempotency_records_idempotency_key'), table_name='order_idempotency_records')
    op.drop_index(op.f('ix_order_idempotency_records_user_id'), table_name='order_idempotency_records')
    op.drop_index(op.f('ix_order_idempotency_records_broker_id'), table_name='order_idempotency_records')
    op.drop_table('order_idempotency_records')
