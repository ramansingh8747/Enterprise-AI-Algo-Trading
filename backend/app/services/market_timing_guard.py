"""
Market Timing Guard Service for Indian Stock Exchanges (NSE / BSE).

Trading Session Boundaries (Indian Standard Time - IST / UTC+05:30):
- Pre-Market: 09:00 - 09:15 IST
- Normal Trading (New Orders Allowed): 09:15 - 15:15 IST (Monday to Friday)
- Intraday Square-Off / Exit Window: 15:15 - 15:25 IST (Exit/Reduction orders only)
- Market Close: 15:30 IST
- Weekends & Post-Market: All new trade executions & signals blocked.
"""

from datetime import datetime, timezone, timedelta, time
from typing import Optional, Tuple
import os
import logging

from app.core.config.settings import settings

logger = logging.getLogger(__name__)

# Indian Standard Time Offset (UTC+5:30)
IST_TIMEZONE = timezone(timedelta(hours=5, minutes=30))


class MarketTimingGuard:
    """Validates whether current time falls within active Indian equity market sessions."""

    @staticmethod
    def get_ist_now(dt: Optional[datetime] = None) -> datetime:
        """Converts given datetime (or current UTC) to Indian Standard Time (IST)."""
        if dt is None:
            dt = datetime.now(timezone.utc)
        elif dt.tzinfo is None:
            # Assume UTC if naive datetime provided
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(IST_TIMEZONE)

    @classmethod
    def is_market_open_for_new_orders(
        cls,
        dt: Optional[datetime] = None,
        enforce_hours: Optional[bool] = None,
    ) -> Tuple[bool, str]:
        """
        Validates if new entry orders (BUY / fresh positions) are permitted.
        Trading window: Monday-Friday, 09:15 AM - 03:15 PM IST.
        """
        if enforce_hours is not None:
            should_enforce = enforce_hours
        else:
            is_testing = os.environ.get("TESTING", "").lower() in ("true", "1")
            should_enforce = settings.ENFORCE_MARKET_HOURS and not is_testing

        if not should_enforce:
            return True, "Market hours enforcement disabled"

        ist_dt = cls.get_ist_now(dt)

        # Check Weekend (Saturday=5, Sunday=6)
        if ist_dt.weekday() >= 5:
            day_name = "Saturday" if ist_dt.weekday() == 5 else "Sunday"
            return False, f"Market is closed on weekends ({day_name})"

        # Parse session start (09:15) and cutoff (15:15)
        start_hour, start_min = map(int, settings.MARKET_OPEN_TIME_IST.split(":"))
        cutoff_hour, cutoff_min = map(int, settings.MARKET_NEW_ORDER_CUTOFF_IST.split(":"))

        session_start = time(start_hour, start_min)
        session_cutoff = time(cutoff_hour, cutoff_min)
        current_time = ist_dt.time()

        if current_time < session_start:
            return (
                False,
                f"Market not yet open (Current IST: {current_time.strftime('%H:%M:%S')}, Opens at {settings.MARKET_OPEN_TIME_IST} AM IST)",
            )

        if current_time > session_cutoff:
            # Allow Afternoon Hero-Zero Gamma Scalper Window up to 15:24 IST
            if current_time <= time(15, 24):
                return True, "Market is open for Afternoon Hero-Zero Gamma Slot (up to 15:24 IST)"
            return (
                False,
                f"New orders closed for the day (Current IST: {current_time.strftime('%H:%M:%S')}, Cutoff was {settings.MARKET_NEW_ORDER_CUTOFF_IST} PM IST)",
            )

        return True, "Market is open for new orders"

    @classmethod
    def is_within_scalper_golden_slots(
        cls,
        dt: Optional[datetime] = None,
    ) -> Tuple[bool, str]:
        """
        Validates if current time falls within one of the 3 Golden Scalper Windows (IST):
        1. 09:20 AM - 10:30 AM (Opening Momentum & Breakout)
        2. 01:15 PM - 02:00 PM (European Market Open Breakout)
        3. 02:15 PM - 03:10 PM (Intraday Short-Covering / Closing Squeeze)
        Outside these 3 slots, new Scalper BUY entries are locked to protect against theta decay and chop.
        """
        ist_dt = cls.get_ist_now(dt)
        curr = ist_dt.time()

        # Slot 1: 09:20 - 10:30 IST
        slot1_start, slot1_end = time(9, 20), time(10, 30)
        # Slot 2: 13:15 - 14:00 IST
        slot2_start, slot2_end = time(13, 15), time(14, 0)
        # Slot 3: 14:15 - 15:10 IST
        slot3_start, slot3_end = time(14, 15), time(15, 10)
        # Slot 4: 15:10 - 15:24 IST (Afternoon Hero-Zero Gamma Scalper Window)
        slot4_start, slot4_end = time(15, 10), time(15, 24)

        if (
            (slot1_start <= curr <= slot1_end)
            or (slot2_start <= curr <= slot2_end)
            or (slot3_start <= curr <= slot3_end)
            or (slot4_start <= curr <= slot4_end)
        ):
            slot_name = "Slot 4 (Hero-Zero Gamma)" if (slot4_start <= curr <= slot4_end) else "Golden Scalper Slot"
            return True, f"Within {slot_name} (Current IST: {curr.strftime('%H:%M:%S')})"

        return False, f"Outside Golden Scalper Slots (Current IST: {curr.strftime('%H:%M:%S')}). Allowed Slots: 09:20-10:30, 13:15-14:00, 14:15-15:10, 15:10-15:24 IST. Execution locked."

    @classmethod
    def is_market_open_for_exits(
        cls,
        dt: Optional[datetime] = None,
        enforce_hours: Optional[bool] = None,
    ) -> Tuple[bool, str]:
        """
        Validates if position exits or stop-loss executions are permitted (up to 15:25 IST).
        """
        if enforce_hours is not None:
            should_enforce = enforce_hours
        else:
            is_testing = os.environ.get("TESTING", "").lower() in ("true", "1")
            should_enforce = settings.ENFORCE_MARKET_HOURS and not is_testing

        if not should_enforce:
            return True, "Market hours enforcement disabled"

        ist_dt = cls.get_ist_now(dt)

        if ist_dt.weekday() >= 5:
            return False, "Market is closed on weekends"

        start_hour, start_min = map(int, settings.MARKET_OPEN_TIME_IST.split(":"))
        close_hour, close_min = map(int, settings.MARKET_CLOSE_TIME_IST.split(":"))

        current_time = ist_dt.time()
        if current_time < time(start_hour, start_min) or current_time > time(close_hour, close_min):
            return (
                False,
                f"Market is closed (Current IST: {current_time.strftime('%H:%M:%S')}, Session: {settings.MARKET_OPEN_TIME_IST} - {settings.MARKET_CLOSE_TIME_IST} IST)",
            )

        return True, "Market is open for exits"

    @classmethod
    def is_intraday_eod_squareoff_time(
        cls,
        dt: Optional[datetime] = None,
    ) -> bool:
        """
        Validates if current time has reached or exceeded the 15:15 IST threshold for mandatory
        intraday EOD square-off (Pillar 5).
        Active between 15:15 IST and 15:25 IST.
        """
        ist_dt = cls.get_ist_now(dt)
        curr = ist_dt.time()
        squareoff_start = time(15, 15)
        squareoff_end = time(15, 25)
        return squareoff_start <= curr <= squareoff_end

    @classmethod
    def is_hero_zero_gamma_slot(
        cls,
        dt: Optional[datetime] = None,
    ) -> bool:
        """
        Validates if current time is within the Afternoon Hero-Zero Gamma Blast window (15:10 - 15:24 IST).
        """
        ist_dt = cls.get_ist_now(dt)
        curr = ist_dt.time()
        return time(15, 10) <= curr <= time(15, 24)

    @classmethod
    def is_hero_zero_hard_exit_time(
        cls,
        dt: Optional[datetime] = None,
    ) -> bool:
        """
        Validates if current time has reached the mandatory 15:24:00 IST sharp hard exit for Hero-Zero positions.
        Active between 15:24:00 and 15:25:00 IST.
        """
        ist_dt = cls.get_ist_now(dt)
        curr = ist_dt.time()
        return time(15, 24) <= curr <= time(15, 25)
