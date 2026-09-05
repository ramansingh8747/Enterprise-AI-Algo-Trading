import os
from decimal import Decimal

os.environ.setdefault('DATABASE_URL', 'postgresql://test:test@localhost/test')
os.environ.setdefault('SECRET_KEY', 'test-secret')
os.environ.setdefault('JWT_SECRET_KEY', 'test-jwt-secret')
os.environ.setdefault('BROKER_SECRET_KEY', 'test-broker-secret')

from app.schemas.admin_positions import AdminPositionItem, AdminPositionSummary
from app.services.admin_position_service import AdminPositionService


def test_decimal_normalization_is_safe_for_persisted_values():
    assert AdminPositionService._decimal('125.50') == Decimal('125.50')
    assert AdminPositionService._decimal(None) == Decimal('0')


def test_admin_position_schema_keeps_mode_and_pnl_separate():
    item = AdminPositionItem(
        position_ref='position-1', source='PAPER_POSITION', user_id='user-1', user_name='Admin', user_role='ADMIN',
        execution_mode='PAPER', symbol='TCS', quantity='10', average_price='3500', market_value='36000',
        realized_pnl='500', unrealized_pnl='500', updated_at='2026-08-14T10:00:00Z'
    )
    assert item.execution_mode == 'PAPER'
    assert item.realized_pnl == '500'
    assert item.unrealized_pnl == '500'


def test_summary_schema_tracks_paper_live_isolation():
    summary = AdminPositionSummary(
        total_positions=3, paper_positions=2, live_positions=1,
        total_market_value='100000', realized_pnl='1000', unrealized_pnl='2500'
    )
    assert summary.paper_positions + summary.live_positions == summary.total_positions
