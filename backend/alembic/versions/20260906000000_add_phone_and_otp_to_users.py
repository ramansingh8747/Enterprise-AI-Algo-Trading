"""add_phone_and_otp_to_users

Revision ID: 20260906000000
Revises: 20260818000000
Create Date: 2026-09-06 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20260906000000'
down_revision = '20260818000000'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add phone_number, otp_code, otp_expires_at to users table
    conn = op.get_bind()
    insp = sa.inspect(conn)
    existing_cols = [c['name'] for c in insp.get_columns('users')]

    if 'phone_number' not in existing_cols:
        op.add_column('users', sa.Column('phone_number', sa.String(length=20), nullable=True))
        op.create_index(op.f('ix_users_phone_number'), 'users', ['phone_number'], unique=True)

    if 'otp_code' not in existing_cols:
        op.add_column('users', sa.Column('otp_code', sa.String(length=10), nullable=True))

    if 'otp_expires_at' not in existing_cols:
        op.add_column('users', sa.Column('otp_expires_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_index(op.f('ix_users_phone_number'), table_name='users')
    op.drop_column('users', 'otp_expires_at')
    op.drop_column('users', 'otp_code')
    op.drop_column('users', 'phone_number')
