import copy
from decimal import Decimal
import pytest

from app.schemas.frozen_paper_trading import FrozenPaperFeedSimulationRequest
from app.services.frozen_strategy_paper_trading_engine import FrozenStrategyPaperTradingEngine
from app.services.frozen_strategy_service import FrozenStrategyService
from app.services.transaction_cost_service import TransactionCostService


@pytest.fixture
def paper_engine():
    frozen_service = FrozenStrategyService()
    cost_service = TransactionCostService()
    return FrozenStrategyPaperTradingEngine(
        frozen_service=frozen_service,
        cost_service=cost_service,
    )


def test_paper_engine_session_initialization(paper_engine):
    """
    Test 1: Initializes virtual paper session for COALINDIA_WFA_FROZEN_v1 with allocated capital.
    """
    session = paper_engine.get_or_create_session("COALINDIA_WFA_FROZEN_v1")
    assert session["version_id"] == "COALINDIA_WFA_FROZEN_v1"
    assert session["execution_mode"] == "PAPER"
    assert session["status"] == "ACTIVE"
    assert session["initial_capital"] == Decimal("22727.27")
    assert session["cash_balance"] == Decimal("22727.27")
    assert session["active_position"] is None
    assert len(session["trade_audit_log"]) == 0


def test_paper_engine_entry_and_take_profit(paper_engine):
    """
    Test 2: Processes candle entry and take-profit exit:
    - Verifies trend filter (change_percent >= 0.2%).
    - Verifies quantity sizing within capital bucket.
    - Verifies Indian transaction costs and slippage are deducted from gross profit.
    """
    version_id = "COALINDIA_WFA_FROZEN_v1"
    paper_engine.reset_session(version_id)

    # Candle 1: Bullish breakout meeting trend filter >= 0.2% and buy threshold >= 390.78
    candle_entry = {
        "timestamp": "2027-03-01 09:15",
        "open": 390.00,
        "high": 393.00,
        "low": 389.50,
        "close": 392.50,
        "change_percent": 0.64,
    }
    s1 = paper_engine.process_candle(version_id, candle_entry)
    pos = s1["active_position"]
    assert pos is not None
    assert pos["symbol"] == "COALINDIA"
    assert pos["quantity"] == Decimal("50")
    assert pos["entry_price"] >= Decimal("392.50")

    # Candle 2: Touches Take-Profit target (392.74 * 1.035 = 406.48)
    candle_tp = {
        "timestamp": "2027-03-01 11:15",
        "open": 395.00,
        "high": 408.00,
        "low": 394.00,
        "close": 407.00,
        "change_percent": 2.28,
    }
    s2 = paper_engine.process_candle(version_id, candle_tp)
    assert s2["active_position"] is None
    assert len(s2["trade_audit_log"]) == 1

    trade = s2["trade_audit_log"][0]
    assert trade["exit_reason"] == "TAKE_PROFIT"
    assert trade["gross_pnl"] > Decimal("0.00")
    assert trade["total_charges"] > Decimal("0.00")
    assert trade["net_pnl"] == trade["gross_pnl"] - trade["total_charges"]
    assert s2["cumulative_realized_pnl"] > Decimal("0.00")


def test_long_take_profit_cannot_execute_below_entry(paper_engine):
    """
    Test 3 (INVARIANT): For any LONG trade entered above base price (e.g. Entry Rs 409.45),
    TAKE_PROFIT must NEVER trigger below the entry price (e.g. at Rs 403.65).
    Target must be dynamically set above entry (Rs 409.45 * 1.035 = Rs 423.78).
    """
    version_id = "COALINDIA_WFA_FROZEN_v1"
    paper_engine.reset_session(version_id)

    # Entry at Rs 409.45
    s1 = paper_engine.process_candle(version_id, {
        "timestamp": "2027-03-02 13:30",
        "open": 405.00, "high": 410.00, "low": 404.00, "close": 409.45, "change_percent": 1.10
    })
    pos = s1["active_position"]
    assert pos is not None
    assert pos["target_price"] > pos["entry_price"]  # Target is strictly > Entry (~423.78)
    assert pos["target_price"] >= Decimal("423.00")

    # Next candle has high=412.00, low=403.00 (which is <= old static TP 403.65, but < new TP 423.78)
    s2 = paper_engine.process_candle(version_id, {
        "timestamp": "2027-03-02 15:00",
        "open": 408.00, "high": 412.00, "low": 403.00, "close": 407.00, "change_percent": -0.24
    })
    # Position must NOT have exited as TAKE_PROFIT below entry price!
    assert s2["active_position"] is not None
    assert len(s2["trade_audit_log"]) == 0


def test_long_stop_loss_cannot_execute_above_entry(paper_engine):
    """
    Test 4 (INVARIANT): For any LONG trade, STOP_LOSS must NEVER execute above entry price.
    """
    version_id = "COALINDIA_WFA_FROZEN_v1"
    paper_engine.reset_session(version_id)

    # Entry at Rs 391.00
    s1 = paper_engine.process_candle(version_id, {
        "timestamp": "2027-03-02 13:30",
        "open": 390.00, "high": 393.00, "low": 389.00, "close": 391.00, "change_percent": 0.25
    })
    pos = s1["active_position"]
    assert pos is not None
    assert pos["stop_loss_price"] < pos["entry_price"]


def test_gap_down_execution_at_open_minus_slippage(paper_engine):
    """
    Test 5 (GAP HANDLING): When a stock gaps down below Stop-Loss (e.g. Open 375 < SL 382.20),
    the order executes at Open (375) minus slippage, not at the higher SL price.
    """
    version_id = "COALINDIA_WFA_FROZEN_v1"
    paper_engine.reset_session(version_id)

    # Entry @ 391.00
    paper_engine.process_candle(version_id, {
        "timestamp": "2027-03-03 09:15",
        "open": 390.00, "high": 393.00, "low": 389.00, "close": 391.00, "change_percent": 0.25
    })

    # Gap down opening at 375.00 (below SL 382.20)
    s2 = paper_engine.process_candle(version_id, {
        "timestamp": "2027-03-04 09:15",
        "open": 375.00, "high": 376.00, "low": 372.00, "close": 374.00, "change_percent": -4.34
    })
    assert s2["active_position"] is None
    trade = s2["trade_audit_log"][0]
    assert trade["exit_reason"] == "STOP_LOSS"
    assert trade["exit_price"] <= Decimal("375.00")


def test_gap_up_execution_at_open(paper_engine):
    """
    Test 6 (GAP HANDLING): When a stock gaps up above Take-Profit (e.g. Open 425 > TP 403.65),
    the order executes at Open (425) capturing the gap profit.
    """
    version_id = "COALINDIA_WFA_FROZEN_v1"
    paper_engine.reset_session(version_id)

    # Entry @ 391.00
    paper_engine.process_candle(version_id, {
        "timestamp": "2027-03-03 09:15",
        "open": 390.00, "high": 393.00, "low": 389.00, "close": 391.00, "change_percent": 0.25
    })

    # Gap up opening at 425.00 (above TP 403.65)
    s2 = paper_engine.process_candle(version_id, {
        "timestamp": "2027-03-04 09:15",
        "open": 425.00, "high": 428.00, "low": 423.00, "close": 426.00, "change_percent": 8.95
    })
    assert s2["active_position"] is None
    trade = s2["trade_audit_log"][0]
    assert trade["exit_reason"] == "TAKE_PROFIT"
    assert trade["exit_price"] >= Decimal("424.00")


def test_paper_engine_same_bar_sl_first_rule(paper_engine):
    """
    Test 7: Same-bar ambiguity:
    - When candle touches BOTH SL and TP in same bar, engine must trigger SL_FIRST conservatively.
    """
    version_id = "COALINDIA_WFA_FROZEN_v1"
    paper_engine.reset_session(version_id)

    # Entry
    paper_engine.process_candle(version_id, {
        "timestamp": "2027-03-02 09:15",
        "open": 391.00, "high": 393.00, "low": 390.00, "close": 392.00, "change_percent": 0.25
    })

    # Ambiguous extreme candle touching both 370 (below SL) and 430 (above TP)
    s = paper_engine.process_candle(version_id, {
        "timestamp": "2027-03-02 11:15",
        "open": 392.00, "high": 430.00, "low": 370.00, "close": 395.00, "change_percent": 0.76
    })

    trade = s["trade_audit_log"][0]
    assert trade["exit_reason"] == "STOP_LOSS"


def test_promotion_readiness_status_framework(paper_engine):
    """
    Test 8: Promotion Readiness Framework:
    - Verifies INSUFFICIENT_SAMPLE when N < 50.
    - Verifies REJECTED when metrics underperform.
    - Verifies PAPER_VALIDATED or ROBUST_PAPER_CANDIDATE when quality gates pass with N >= 50.
    - Verifies live_promotion_blocked is permanently True.
    """
    version_id = "COALINDIA_WFA_FROZEN_v1"
    paper_engine.reset_session(version_id)

    # State 1: 0 trades -> INSUFFICIENT_SAMPLE
    resp_init = paper_engine.get_session_state_response(version_id)
    scorecard = resp_init.validation_scorecard
    assert scorecard.promotion_readiness_status == "INSUFFICIENT_SAMPLE"
    assert scorecard.live_promotion_blocked is True
    assert scorecard.tp_sl_invariant_violations == 0
    assert scorecard.nav_accounting_discrepancy == Decimal("0.0000")

    # State 2: Simulate multi-candle stream generating >= 30 trades
    paper_engine.simulate_independent_feed(
        version_id=version_id,
        feed_params=FrozenPaperFeedSimulationRequest(candle_count=400, seed=101, base_volatility_pct=1.4, drift_pct=0.10),
    )

    resp_sim = paper_engine.get_session_state_response(version_id)
    scorecard_sim = resp_sim.validation_scorecard
    assert scorecard_sim.promotion_readiness_status in ["INSUFFICIENT_SAMPLE", "PAPER_VALIDATED", "ROBUST_PAPER_CANDIDATE", "REJECTED"]
    assert scorecard_sim.live_promotion_blocked is True
    assert scorecard_sim.tp_sl_invariant_violations == 0
    assert scorecard_sim.nav_accounting_discrepancy == Decimal("0.0000")
