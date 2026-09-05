import json
import uuid
from decimal import Decimal
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.models.trading_risk_settings import TradingRiskSettings
from app.services.backtesting_engine_service import BacktestingEngineService, BacktestTrade, BacktestChartMarker

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


def test_44_strategy_baseline_capital_allocation_and_backtest():
    """
    Test 1: 44 strategies initialized with baseline capital (Rs 10,00,000 / 44 = Rs 22,727.27).
    Runs multi-symbol candle data, executes trades, applies Indian costs, and produces consolidated report.
    """
    backtest_service = BacktestingEngineService()

    symbols = [
        "HDFCBANK", "RELIANCE", "TCS", "INFY", "ICICIBANK", "SBIN", "LT", "TATAMOTORS",
        "BHARTIARTL", "KOTAKBANK", "AXISBANK", "BAJFINANCE", "BAJAJFINSV", "WIPRO",
        "HCLTECH", "TECHM", "LTIM", "MARUTI", "M&M", "BAJAJ-AUTO", "EICHERMOT",
        "TATASTEEL", "JSWSTEEL", "HINDALCO", "COALINDIA", "ONGC", "POWERGRID", "NTPC",
        "BPCL", "ADANIENT", "ADANIPORTS", "ITC", "HINDUNILVR", "NESTLEIND", "TITAN",
        "ASIANPAINT", "SUNPHARMA", "CIPLA", "DRREDDY", "ULTRACEMCO", "BANKNIFTY", "SENSEX",
        "NIFTY", "DIVISLAB"
    ]
    assert len(symbols) == 44

    strat_defs = []
    candles_by_symbol = {}

    for sym in symbols:
        strat_defs.append({
            "id": f"STRAT_{sym}",
            "name": f"{sym} Trend Momentum Strategy",
            "config": {
                "symbol": sym,
                "quantity": 10,
                "side": "BUY",
                "stop_loss": 980.0,
                "target": 1050.0,
            }
        })
        candles_by_symbol[sym] = [
            {"timestamp": "2026-08-01 09:15", "open": 1000.0, "high": 1010.0, "low": 995.0, "close": 1005.0, "change_percent": 0.5},
            {"timestamp": "2026-08-01 09:20", "open": 1005.0, "high": 1025.0, "low": 1000.0, "close": 1020.0, "change_percent": 1.5},
            {"timestamp": "2026-08-01 09:25", "open": 1020.0, "high": 1055.0, "low": 1015.0, "close": 1052.0, "change_percent": 3.1},  # TP Hit
            {"timestamp": "2026-08-01 09:30", "open": 1052.0, "high": 1055.0, "low": 1040.0, "close": 1045.0, "change_percent": -0.6},
            {"timestamp": "2026-08-01 09:35", "open": 1045.0, "high": 1048.0, "low": 1035.0, "close": 1040.0, "change_percent": -0.4},
        ]

    # Run complete 44-strategy backtest with auto-sizing
    report = backtest_service.run_multi_strategy_backtest(
        strategy_definitions=strat_defs,
        historical_candles_by_symbol=candles_by_symbol,
        total_initial_capital=Decimal("1000000.00"),
        apply_transaction_costs=True,
        apply_slippage=True,
        auto_size_to_bucket=True,
    )

    # 1. Capital Allocation Assertions
    assert report.initial_total_capital == Decimal("1000000.00")
    assert len(report.strategy_summaries) == 44
    for summary in report.strategy_summaries:
        assert summary.allocated_capital == Decimal("22727.2727")
        assert summary.signals_generated > 0
        assert summary.trades_executed > 0
        assert summary.total_trades > 0

    # 2. Consolidated Report Assertions
    assert report.total_trades >= 44
    assert report.total_signals_generated >= 44
    assert report.total_trades_executed >= 44
    assert report.total_trades_blocked_capital == 0
    assert report.total_trades_blocked_risk_limit == 0
    assert report.total_net_pnl > Decimal("0.00")
    assert report.final_portfolio_nav > Decimal("1000000.00")
    assert len(report.chart_markers) > 0


def test_same_candle_sl_tp_ambiguity_conservative_sl_first():
    """
    Test 2: When both Stop-Loss and Target are touched in the same candle:
    - SL_FIRST setting must execute Stop-Loss (conservative worst-case).
    - TP_FIRST setting must execute Target.
    """
    backtest_service = BacktestingEngineService()

    strat_def = [{
        "id": "STRAT_AMBIGUITY",
        "name": "Same Candle Ambiguity Strategy",
        "config": {
            "symbol": "RELIANCE",
            "quantity": 10,
            "side": "BUY",
            "stop_loss": 980.0,
            "target": 1050.0,
        }
    }]

    ambiguous_candles = {
        "RELIANCE": [
            {"timestamp": "2026-08-01 09:15", "open": 1000.0, "high": 1005.0, "low": 995.0, "close": 1000.0, "change_percent": 0.0},
            {"timestamp": "2026-08-01 09:20", "open": 1000.0, "high": 1060.0, "low": 970.0, "close": 1010.0, "change_percent": 1.0},
        ]
    }

    # Case A: Default Conservative SL_FIRST
    report_sl_first = backtest_service.run_multi_strategy_backtest(
        strategy_definitions=strat_def,
        historical_candles_by_symbol=ambiguous_candles,
        same_bar_sl_tp_rule="SL_FIRST",
        apply_transaction_costs=True,
    )
    summary_sl = report_sl_first.strategy_summaries[0]
    assert len(summary_sl.trades) == 1
    assert summary_sl.trades[0].exit_reason == "STOP_LOSS"
    assert summary_sl.trades[0].net_pnl < Decimal("0.00")

    # Case B: TP_FIRST
    report_tp_first = backtest_service.run_multi_strategy_backtest(
        strategy_definitions=strat_def,
        historical_candles_by_symbol=ambiguous_candles,
        same_bar_sl_tp_rule="TP_FIRST",
        apply_transaction_costs=True,
    )
    summary_tp = report_tp_first.strategy_summaries[0]
    assert len(summary_tp.trades) == 1
    assert summary_tp.trades[0].exit_reason == "TAKE_PROFIT"
    assert summary_tp.trades[0].net_pnl > Decimal("0.00")


def test_look_ahead_bias_prevention():
    """
    Test 3: Look-Ahead Bias Prevention:
    - Signals generated at bar t only see information up to bar t.
    - Future bar data (t+1) does NOT trigger retroactive entries.
    """
    backtest_service = BacktestingEngineService()

    strat_def = [{
        "id": "STRAT_LOOKAHEAD",
        "name": "Lookahead Test Strategy",
        "config": {
            "symbol": "TCS",
            "quantity": 10,
            "side": "DYNAMIC",
            "buy_threshold": 3100.0,  # Only buy when price >= 3100
        }
    }]

    candles = {
        "TCS": [
            {"timestamp": "2026-08-01 09:15", "open": 2990.0, "high": 3005.0, "low": 2985.0, "close": 3000.0, "change_percent": 0.0},
            {"timestamp": "2026-08-01 09:20", "open": 3000.0, "high": 3060.0, "low": 2995.0, "close": 3050.0, "change_percent": 1.6},
            {"timestamp": "2026-08-01 09:25", "open": 3050.0, "high": 3130.0, "low": 3045.0, "close": 3120.0, "change_percent": 2.2},
            {"timestamp": "2026-08-01 09:30", "open": 3120.0, "high": 3150.0, "low": 3110.0, "close": 3140.0, "change_percent": 0.6},
        ]
    }

    report = backtest_service.run_multi_strategy_backtest(
        strategy_definitions=strat_def,
        historical_candles_by_symbol=candles,
    )

    summary = report.strategy_summaries[0]
    markers = [m for m in report.chart_markers if m.marker_type == "BUY"]
    assert len(markers) == 1
    assert markers[0].timestamp == "2026-08-01 09:25"
    assert markers[0].price >= Decimal("3120.00")


def test_multi_strategy_exposure_limit_blocking_in_backtest():
    """
    Test 4: Portfolio-Wide Single-Stock Exposure Limit in Backtest:
    - 3 strategies trade RELIANCE.
    - Single-stock limit = 50 shares.
    - Strategy 1 buys 30 shares -> Allowed (Combined = 30).
    - Strategy 2 buys 20 shares -> Allowed (Combined = 50).
    - Strategy 3 attempts to buy 20 shares -> Blocked by RiskEngine (Projected = 70 > 50).
    """
    backtest_service = BacktestingEngineService()

    strat_defs = [
        {"id": "S1", "name": "Strat 1", "config": {"symbol": "RELIANCE", "quantity": 30, "side": "BUY"}},
        {"id": "S2", "name": "Strat 2", "config": {"symbol": "RELIANCE", "quantity": 20, "side": "BUY"}},
        {"id": "S3", "name": "Strat 3", "config": {"symbol": "RELIANCE", "quantity": 20, "side": "BUY"}},
    ]

    candles = {
        "RELIANCE": [
            {"timestamp": "2026-08-01 09:15", "open": 1000.0, "high": 1010.0, "low": 995.0, "close": 1005.0, "change_percent": 0.5},
            {"timestamp": "2026-08-01 09:20", "open": 1005.0, "high": 1055.0, "low": 1000.0, "close": 1050.0, "change_percent": 4.5},
        ]
    }

    risk_settings = TradingRiskSettings(
        max_position_quantity=Decimal("50"), # Max 50 shares of RELIANCE across all strategies
    )

    report = backtest_service.run_multi_strategy_backtest(
        strategy_definitions=strat_defs,
        historical_candles_by_symbol=candles,
        risk_settings=risk_settings,
    )

    s1_summary = next(s for s in report.strategy_summaries if s.strategy_id == "S1")
    s2_summary = next(s for s in report.strategy_summaries if s.strategy_id == "S2")
    s3_summary = next(s for s in report.strategy_summaries if s.strategy_id == "S3")

    assert s1_summary.trades_executed >= 1
    assert s2_summary.trades_executed >= 1
    assert s3_summary.trades_executed == 0
    assert s3_summary.trades_blocked_risk_limit >= 1
    assert s3_summary.net_realized_pnl == Decimal("0.00")


def test_auto_size_to_bucket_capital_affordability_and_audit():
    """
    Test 5: High-priced stock (Maruti @ Rs 12,400) requesting 10 shares (Rs 1,24,000)
    with a Rs 22,727 capital bucket:
    - When auto_size_to_bucket=True: Auto-caps to 1 share (Rs 12,400 <= 22,727), executes trade cleanly.
    - When auto_size_to_bucket=False: Blocks trade due to insufficient capital (trades_blocked_capital = 1).
    """
    backtest_service = BacktestingEngineService()

    strat_def = [{
        "id": "STRAT_MARUTI",
        "name": "Maruti High Value Strategy",
        "config": {
            "symbol": "MARUTI",
            "quantity": 10,  # 10 shares @ 12,400 = Rs 1,24,000 (> Rs 22,727 bucket)
            "side": "BUY",
            "target": 12800.0,
        }
    }]

    candles = {
        "MARUTI": [
            {"timestamp": "2026-08-01 09:15", "open": 12400.0, "high": 12450.0, "low": 12380.0, "close": 12400.0, "change_percent": 0.0},
            {"timestamp": "2026-08-01 09:20", "open": 12400.0, "high": 12900.0, "low": 12390.0, "close": 12850.0, "change_percent": 3.6},
        ]
    }

    # Case A: Auto-sizing Enabled (auto_size_to_bucket=True)
    report_auto = backtest_service.run_multi_strategy_backtest(
        strategy_definitions=strat_def,
        historical_candles_by_symbol=candles,
        total_initial_capital=Decimal("22727.27"),
        auto_size_to_bucket=True,
    )
    summary_auto = report_auto.strategy_summaries[0]
    assert summary_auto.signals_generated >= 1
    assert summary_auto.trades_executed >= 1
    assert summary_auto.trades_blocked_capital == 0
    assert len(summary_auto.trades) >= 1
    assert summary_auto.trades[0].quantity == Decimal("1.0000")  # Auto-sized to 1 share

    # Case B: Auto-sizing Disabled (auto_size_to_bucket=False)
    report_no_auto = backtest_service.run_multi_strategy_backtest(
        strategy_definitions=strat_def,
        historical_candles_by_symbol=candles,
        total_initial_capital=Decimal("22727.27"),
        auto_size_to_bucket=False,
    )
    summary_no_auto = report_no_auto.strategy_summaries[0]
    assert summary_no_auto.signals_generated >= 1
    assert summary_no_auto.trades_executed == 0
    assert summary_no_auto.trades_blocked_capital >= 1  # Correctly audited as blocked by capital!
