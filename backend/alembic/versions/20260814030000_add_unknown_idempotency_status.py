"""Allow UNKNOWN status for order idempotency records.

Revision ID: 20260814030000
"""
from alembic import op
import sqlalchemy as sa

revision = "20260814030000"
down_revision = "20260814020000"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.alter_column(
        "order_idempotency_records",
        "status",
        existing_type=sa.String(length=32),
        existing_nullable=False,
    )

def downgrade() -> None:
    # UNKNOWN is represented as data, not a DB enum; no schema rollback is required.
    pass
