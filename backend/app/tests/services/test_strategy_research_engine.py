import json
import uuid
from decimal import Decimal
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.services.backtesting_engine_service import BacktestingEngineService
from app.services.strategy_research_engine_service import (
    StrategyResearchEngineService,
    OptimizationCandidate,
    MultiWindowConsolidatedReport,
)

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


def test_multi_window_rolling_wfa_consistency_and_robustness():
    """
    Test 1: Multi-Window Rolling WFA with consistency verification:
    - 4 sequential rolling windows across different market conditions.
    - Tests parameter optimization on each IS window and validates on OOS.
    - Strategy passing >= 75% of windows (e.g. 3/4 or 4/4) is marked as ROBUST_WINNER.
    - Original 44 strategy definitions are 100% untouched.
    """
    research_service = StrategyResearchEngineService()

    orig_def = [{
        "id": "STRAT_CONSISTENT",
        "name": "Consistent Trend Strategy",
        "config": {
            "symbol": "TCS",
            "quantity": 10,
            "side": "DYNAMIC",
            "buy_threshold": 3200.0,
            "stop_loss": 3136.0,
            "target": 3312.0,
        }
    }]

    rolling_data = [
        {
            "window_id": "WIN_01",
            "name": "Window 1 (Expansion)",
            "is_candles": {"TCS": [
                {"timestamp": "2026-07-01 09:15", "open": 3200.0, "high": 3250.0, "low": 3190.0, "close": 3240.0, "change_percent": 1.25},
                {"timestamp": "2026-07-01 11:30", "open": 3240.0, "high": 3380.0, "low": 3230.0, "close": 3360.0, "change_percent": 3.70},
            ]},
            "oos_candles": {"TCS": [
                {"timestamp": "2026-07-08 09:15", "open": 3200.0, "high": 3240.0, "low": 3190.0, "close": 3230.0, "change_percent": 0.93},
                {"timestamp": "2026-07-08 11:30", "open": 3230.0, "high": 3380.0, "low": 3220.0, "close": 3370.0, "change_percent": 4.33},
            ]}
        },
        {
            "window_id": "WIN_02",
            "name": "Window 2 (Momentum)",
            "is_candles": {"TCS": [
                {"timestamp": "2026-07-15 09:15", "open": 3200.0, "high": 3230.0, "low": 3195.0, "close": 3225.0, "change_percent": 0.78},
                {"timestamp": "2026-07-15 11:30", "open": 3225.0, "high": 3390.0, "low": 3220.0, "close": 3380.0, "change_percent": 4.80},
            ]},
            "oos_candles": {"TCS": [
                {"timestamp": "2026-07-22 09:15", "open": 3200.0, "high": 3235.0, "low": 3190.0, "close": 3230.0, "change_percent": 0.93},
                {"timestamp": "2026-07-22 11:30", "open": 3230.0, "high": 3390.0, "low": 3220.0, "close": 3380.0, "change_percent": 4.64},
            ]}
        },
        {
            "window_id": "WIN_03",
            "name": "Window 3 (Steady Trend)",
            "is_candles": {"TCS": [
                {"timestamp": "2026-08-01 09:15", "open": 3200.0, "high": 3240.0, "low": 3190.0, "close": 3235.0, "change_percent": 1.09},
                {"timestamp": "2026-08-01 11:30", "open": 3235.0, "high": 3380.0, "low": 3225.0, "close": 3370.0, "change_percent": 4.17},
            ]},
            "oos_candles": {"TCS": [
                {"timestamp": "2026-08-08 09:15", "open": 3200.0, "high": 3245.0, "low": 3195.0, "close": 3240.0, "change_percent": 1.25},
                {"timestamp": "2026-08-08 11:30", "open": 3240.0, "high": 3385.0, "low": 3230.0, "close": 3375.0, "change_percent": 4.16},
            ]}
        },
        {
            "window_id": "WIN_04",
            "name": "Window 4 (Consolidation Recovery)",
            "is_candles": {"TCS": [
                {"timestamp": "2026-08-15 09:15", "open": 3200.0, "high": 3230.0, "low": 3190.0, "close": 3220.0, "change_percent": 0.62},
                {"timestamp": "2026-08-15 11:30", "open": 3220.0, "high": 3380.0, "low": 3210.0, "close": 3365.0, "change_percent": 4.50},
            ]},
            "oos_candles": {"TCS": [
                {"timestamp": "2026-08-22 09:15", "open": 3200.0, "high": 3235.0, "low": 3190.0, "close": 3225.0, "change_percent": 0.78},
                {"timestamp": "2026-08-22 11:30", "open": 3225.0, "high": 3380.0, "low": 3215.0, "close": 3370.0, "change_percent": 4.49},
            ]}
        },
    ]

    report = research_service.run_multi_window_rolling_wfa(
        strategy_definitions=orig_def,
        rolling_windows_data=rolling_data,
        total_initial_capital=Decimal("25000.00"),
        min_total_oos_trades=4,
        min_window_pass_ratio=0.75,
    )

    s_rep = report.strategy_reports[0]
    assert s_rep.total_oos_trades == 4
    assert s_rep.windows_passed == 4
    assert s_rep.windows_total == 4
    assert s_rep.consistency_score_pct == 100.0
    assert s_rep.robustness_status == "ROBUST_WINNER"
    assert s_rep.cumulative_net_pnl > Decimal("0.00")
    assert orig_def[0]["config"]["stop_loss"] == 3136.0


def test_multi_window_inconsistent_rejection():
    """
    Test 2: Rejection of Inconsistent Strategy:
    - Strategy passes 1 window but fails 3 windows on unseen OOS data.
    - Consistency score = 25% (< required 75%).
    - Must be classified as REJECTED_INCONSISTENT or REJECTED_NEGATIVE_PNL.
    """
    research_service = StrategyResearchEngineService()

    strat_def = [{
        "id": "STRAT_INCONSISTENT",
        "name": "Inconsistent Strategy",
        "config": {"symbol": "SBIN", "quantity": 10, "side": "DYNAMIC", "buy_threshold": 800.0}
    }]

    rolling_data = [
        # Win 1: Pass (2 candles: entry + TP exit)
        {"window_id": "W1", "is_candles": {"SBIN": [{"timestamp": "2026-07-01 09:15", "open": 800.0, "high": 840.0, "low": 795.0, "close": 805.0, "change_percent": 0.6},
                                                     {"timestamp": "2026-07-01 11:30", "open": 805.0, "high": 845.0, "low": 800.0, "close": 840.0, "change_percent": 4.3}]},
         "oos_candles": {"SBIN": [{"timestamp": "2026-07-08 09:15", "open": 800.0, "high": 840.0, "low": 795.0, "close": 805.0, "change_percent": 0.6},
                                  {"timestamp": "2026-07-08 11:30", "open": 805.0, "high": 845.0, "low": 800.0, "close": 840.0, "change_percent": 4.3}]}},
        # Win 2: Fail (Loss)
        {"window_id": "W2", "is_candles": {"SBIN": [{"timestamp": "2026-07-15 09:15", "open": 800.0, "high": 840.0, "low": 795.0, "close": 835.0, "change_percent": 4.3}]},
         "oos_candles": {"SBIN": [{"timestamp": "2026-07-22 09:15", "open": 800.0, "high": 805.0, "low": 795.0, "close": 802.0, "change_percent": 0.2},
                                  {"timestamp": "2026-07-22 11:30", "open": 802.0, "high": 803.0, "low": 740.0, "close": 745.0, "change_percent": -7.1}]}},
        # Win 3: Fail (Loss)
        {"window_id": "W3", "is_candles": {"SBIN": [{"timestamp": "2026-08-01 09:15", "open": 800.0, "high": 840.0, "low": 795.0, "close": 835.0, "change_percent": 4.3}]},
         "oos_candles": {"SBIN": [{"timestamp": "2026-08-08 09:15", "open": 800.0, "high": 805.0, "low": 795.0, "close": 802.0, "change_percent": 0.2},
                                  {"timestamp": "2026-08-08 11:30", "open": 802.0, "high": 803.0, "low": 740.0, "close": 745.0, "change_percent": -7.1}]}},
        # Win 4: Fail (Loss)
        {"window_id": "W4", "is_candles": {"SBIN": [{"timestamp": "2026-08-15 09:15", "open": 800.0, "high": 840.0, "low": 795.0, "close": 835.0, "change_percent": 4.3}]},
         "oos_candles": {"SBIN": [{"timestamp": "2026-08-22 09:15", "open": 800.0, "high": 805.0, "low": 795.0, "close": 802.0, "change_percent": 0.2},
                                  {"timestamp": "2026-08-22 11:30", "open": 802.0, "high": 803.0, "low": 740.0, "close": 745.0, "change_percent": -7.1}]}},
    ]

    report = research_service.run_multi_window_rolling_wfa(
        strategy_definitions=strat_def,
        rolling_windows_data=rolling_data,
        total_initial_capital=Decimal("25000.00"),
        min_total_oos_trades=4,
        min_window_pass_ratio=0.75,
    )

    s_rep = report.strategy_reports[0]
    assert s_rep.windows_passed == 1
    assert s_rep.windows_total == 4
    assert s_rep.consistency_score_pct == 25.0
    assert "REJECTED" in s_rep.robustness_status
    assert report.inconsistent_strategies_count >= 1
