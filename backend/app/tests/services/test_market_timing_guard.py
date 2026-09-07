from datetime import datetime, timezone, timedelta
import pytest
from app.services.market_timing_guard import MarketTimingGuard, IST_TIMEZONE
from app.core.config.settings import settings


def test_market_timing_guard_allows_during_active_trading_hours():
    """Wednesday 11:30 AM IST is within normal trading hours."""
    # 2026-08-19 is a Wednesday. 11:30 AM IST = 06:00 AM UTC
    wed_market_time = datetime(2026, 8, 19, 6, 0, 0, tzinfo=timezone.utc)
    is_open, msg = MarketTimingGuard.is_market_open_for_new_orders(wed_market_time, enforce_hours=True)
    assert is_open is True
    assert "open" in msg.lower()


def test_market_timing_guard_blocks_pre_market():
    """Wednesday 08:30 AM IST is before 09:15 AM open."""
    # 08:30 AM IST = 03:00 AM UTC
    pre_market_time = datetime(2026, 8, 19, 3, 0, 0, tzinfo=timezone.utc)
    is_open, msg = MarketTimingGuard.is_market_open_for_new_orders(pre_market_time, enforce_hours=True)
    assert is_open is False
    assert "not yet open" in msg.lower()


def test_market_timing_guard_blocks_post_market_hours():
    """Wednesday 16:51 PM IST is after 15:15 cutoff."""
    # 16:51 PM IST = 11:21 AM UTC
    post_market_time = datetime(2026, 8, 19, 11, 21, 0, tzinfo=timezone.utc)
    is_open, msg = MarketTimingGuard.is_market_open_for_new_orders(post_market_time, enforce_hours=True)
    assert is_open is False
    assert "closed for the day" in msg.lower() or "cutoff" in msg.lower()


def test_market_timing_guard_blocks_weekends():
    """Saturday 11:30 AM IST must be blocked."""
    # 2026-08-22 is Saturday
    saturday_time = datetime(2026, 8, 22, 6, 0, 0, tzinfo=timezone.utc)
    is_open, msg = MarketTimingGuard.is_market_open_for_new_orders(saturday_time, enforce_hours=True)
    assert is_open is False
    assert "weekends" in msg.lower()


def test_market_timing_guard_disabled_returns_true():
    """When enforcement is disabled, orders are permitted (for testing)."""
    post_market_time = datetime(2026, 8, 19, 11, 21, 0, tzinfo=timezone.utc)
    is_open, msg = MarketTimingGuard.is_market_open_for_new_orders(post_market_time, enforce_hours=False)
    assert is_open is True


def test_market_timing_guard_blocks_opening_15_minutes():
    """Wednesday 09:20 AM IST must be blocked by opening volatility filter (before 09:30 AM)."""
    # 09:20 AM IST = 03:50 AM UTC
    opening_chop_time = datetime(2026, 8, 19, 3, 50, 0, tzinfo=timezone.utc)
    is_open, msg = MarketTimingGuard.is_market_open_for_new_orders(opening_chop_time, enforce_hours=True)
    assert is_open is False
    assert "volatility filter" in msg.lower() or "09:30" in msg

    # But exits at 09:20 AM IST must be permitted
    can_exit, exit_msg = MarketTimingGuard.is_market_open_for_exits(opening_chop_time, enforce_hours=True)
    assert can_exit is True

