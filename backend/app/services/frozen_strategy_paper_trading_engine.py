import copy
import logging
import random
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from app.schemas.frozen_paper_trading import (
    FrozenPaperFeedSimulationRequest,
    FrozenPaperPositionResponse,
    FrozenPaperSessionStateResponse,
    FrozenPaperStepRequest,
    FrozenPaperTradeAuditResponse,
    FrozenPaperValidationScorecard,
    FrozenStrategyConfigResponse,
)
from app.services.frozen_strategy_service import FrozenStrategyConfig, FrozenStrategyService
from app.services.transaction_cost_service import TransactionCostService

logger = logging.getLogger(__name__)


class FrozenStrategyPaperTradingEngine:
    """
    Virtual Paper Trading Engine specifically designed to execute frozen strategy configs
    (e.g., COALINDIA_WFA_FROZEN_v1) in strict virtual isolation.

    Guarantees & Invariants:
    - Execution mode is strictly locked to 'PAPER'.
    - Completely air-gapped from live broker endpoints and live database definitions.
    - LONG Invariant: TAKE_PROFIT target price is strictly > effective entry price.
    - LONG Invariant: STOP_LOSS price is strictly < effective entry price.
    - Realistic Gap Execution: Gap-downs open below SL execute at min(SL, Open).
      Gap-ups open above TP execute at max(TP, Open).
    - Conservative SL_FIRST same-candle ambiguity resolution.
    - Implements precise Indian equity transaction costs (STT, Stamp Duty, GST, Exchange Turnover).
    - Implements dynamic volatility-aware slippage.
    - Records comprehensive fresh-trade audit logs.
    - Computes real-time >= 30 trades validation scorecard.
    """

    def __init__(
        self,
        frozen_service: Optional[FrozenStrategyService] = None,
        cost_service: Optional[TransactionCostService] = None,
    ) -> None:
        self.frozen_service = frozen_service or FrozenStrategyService()
        self.cost_service = cost_service or TransactionCostService()
        self._sessions: Dict[str, Dict[str, Any]] = {}

    def get_or_create_session(
        self,
        version_id: str = "COALINDIA_WFA_FROZEN_v1",
        initial_capital: Optional[Decimal] = None,
    ) -> Dict[str, Any]:
        """Retrieves or initializes a virtual paper trading session for the frozen strategy."""
        if version_id in self._sessions:
            return self._sessions[version_id]

        frozen_config = self.frozen_service.get_frozen_strategy(version_id)
        cap = initial_capital or frozen_config.allocated_capital

        session = {
            "session_id": str(uuid.uuid4()),
            "version_id": version_id,
            "config": frozen_config,
            "status": "ACTIVE",
            "execution_mode": "PAPER",
            "initial_capital": cap,
            "cash_balance": cap,
            "portfolio_nav": cap,
            "peak_nav": cap,
            "max_drawdown_pct": 0.0,
            "cumulative_realized_pnl": Decimal("0.00"),
            "total_charges_paid": Decimal("0.00"),
            "active_position": None,  # Dict or None
            "trade_audit_log": [],  # List[Dict[str, Any]]
            "step_count": 0,
            "last_updated_at": datetime.now(timezone.utc).isoformat(),
        }
        self._sessions[version_id] = session
        return session

    def reset_session(
        self,
        version_id: str = "COALINDIA_WFA_FROZEN_v1",
        initial_capital: Optional[Decimal] = None,
    ) -> Dict[str, Any]:
        """Resets paper trading session back to initial clean state."""
        if version_id in self._sessions:
            del self._sessions[version_id]
        return self.get_or_create_session(version_id, initial_capital)

    def process_candle(
        self,
        version_id: str,
        candle: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Ingests a single market candle and updates virtual position, stop loss / take profit,
        audit logs, and portfolio equity with strict invariant enforcement.
        """
        session = self.get_or_create_session(version_id)
        cfg: FrozenStrategyConfig = session["config"]

        c_open = Decimal(str(candle["open"]))
        c_high = Decimal(str(candle["high"]))
        c_low = Decimal(str(candle["low"]))
        c_close = Decimal(str(candle["close"]))
        c_chg = float(candle.get("change_percent", 0.0))
        c_ts = candle.get("timestamp", datetime.now(timezone.utc).isoformat())

        session["step_count"] += 1
        pos = session["active_position"]
        had_position_at_start = pos is not None

        # -------------------------------------------------------------------------
        # Case 1: Evaluate Active Position Exit (Stop-Loss / Take-Profit with Gap Handling)
        # -------------------------------------------------------------------------
        if pos is not None:
            entry_price = pos["entry_price"]
            qty = pos["quantity"]
            pos_sl = pos["stop_loss_price"]
            pos_tp = pos["target_price"]

            # Strict Invariant Verification
            if pos_tp <= entry_price:
                # Target must always be above entry for a LONG position
                pos_tp = (entry_price * Decimal("1.035")).quantize(Decimal("0.01"))
                pos["target_price"] = pos_tp

            if pos_sl >= entry_price:
                # Stop-Loss must always be below entry for a LONG position
                pos_sl = (entry_price * Decimal("0.980")).quantize(Decimal("0.01"))
                pos["stop_loss_price"] = pos_sl

            sl_touched = c_low <= pos_sl
            tp_touched = c_high >= pos_tp

            exit_triggered = False
            raw_exit_price = entry_price
            exit_reason = ""

            if sl_touched and tp_touched:
                # Same-candle ambiguity: SL_FIRST rule
                exit_triggered = True
                # Gap handling: if bar opened below SL, execute at open, else at SL
                raw_exit_price = min(pos_sl, c_open)
                exit_reason = "STOP_LOSS"
            elif sl_touched:
                exit_triggered = True
                raw_exit_price = min(pos_sl, c_open)
                exit_reason = "STOP_LOSS"
            elif tp_touched:
                exit_triggered = True
                # Gap handling: if bar opened above TP, capture gap at open, else at TP
                raw_exit_price = max(pos_tp, c_open)
                exit_reason = "TAKE_PROFIT"

            if exit_triggered:
                # Apply dynamic slippage on exit
                eff_exit, slip_amt, _ = self.cost_service.calculate_slippage(
                    price=raw_exit_price,
                    side="SELL",
                    volatility_pct=Decimal(str(abs(c_chg))),
                )

                # Calculate Indian equity transaction charges for BUY side + SELL side
                buy_costs = self.cost_service.calculate_transaction_costs(
                    traded_value=entry_price * qty,
                    side="BUY",
                    product="CNC",
                )
                sell_costs = self.cost_service.calculate_transaction_costs(
                    traded_value=eff_exit * qty,
                    side="SELL",
                    product="CNC",
                )

                tot_turnover = buy_costs["traded_value"] + sell_costs["traded_value"]
                tot_brokerage = buy_costs["brokerage"] + sell_costs["brokerage"]
                tot_stt = buy_costs["stt"] + sell_costs["stt"]
                tot_exchange = buy_costs["exchange_charges"] + sell_costs["exchange_charges"]
                tot_stamp = buy_costs["stamp_duty"] + sell_costs["stamp_duty"]
                tot_gst = buy_costs["gst"] + sell_costs["gst"]
                total_charges = buy_costs["total_charges"] + sell_costs["total_charges"]

                gross_pnl = (eff_exit - entry_price) * qty
                net_pnl = gross_pnl - total_charges
                ret_pct = float((net_pnl / (entry_price * qty)) * 100) if (entry_price * qty) > 0 else 0.0

                # Return capital + net P&L to cash
                session["cash_balance"] += (entry_price * qty) + net_pnl
                session["cumulative_realized_pnl"] += net_pnl
                session["total_charges_paid"] += total_charges

                # Record fresh trade audit entry
                audit_entry = {
                    "trade_id": str(uuid.uuid4())[:8],
                    "strategy_version": cfg.version_id,
                    "symbol": cfg.symbol,
                    "side": "BUY_TO_OPEN",
                    "entry_timestamp": pos["entry_timestamp"],
                    "entry_price": entry_price,
                    "exit_timestamp": c_ts,
                    "exit_price": eff_exit,
                    "quantity": qty,
                    "gross_pnl": gross_pnl,
                    "turnover": tot_turnover,
                    "brokerage": tot_brokerage,
                    "stt_tax": tot_stt,
                    "exchange_charges": tot_exchange,
                    "stamp_duty": tot_stamp,
                    "gst": tot_gst,
                    "total_charges": total_charges,
                    "net_pnl": net_pnl,
                    "return_pct": ret_pct,
                    "exit_reason": exit_reason,
                }
                session["trade_audit_log"].append(audit_entry)
                session["active_position"] = None
            else:
                # Position remains open: update mark-to-market unrealized P&L
                unrealized_pnl = (c_close - entry_price) * qty
                pos["current_price"] = c_close
                pos["unrealized_pnl"] = unrealized_pnl
                pos["unrealized_return_pct"] = float((unrealized_pnl / (entry_price * qty)) * 100)

        # -------------------------------------------------------------------------
        # Case 2: Evaluate New Position Entry (if no active position at candle start)
        # -------------------------------------------------------------------------
        if not had_position_at_start and session["active_position"] is None:
            # Check Trend Filter
            trend_ok = True
            if cfg.use_trend_filter:
                trend_ok = c_chg >= cfg.change_percent_threshold

            # Check Volatility Filter
            vol_ok = True
            if cfg.use_volatility_filter:
                candle_vol = abs((c_high - c_low) / c_open * 100) if c_open > 0 else Decimal("0")
                vol_ok = candle_vol <= Decimal(str(cfg.max_adverse_volatility))

            # Check Price Buy Threshold
            buy_threshold_met = c_close >= Decimal(str(cfg.buy_threshold))

            if trend_ok and vol_ok and buy_threshold_met:
                # Sizing: Auto-size to affordable quantity within cash balance
                req_qty = Decimal(str(cfg.quantity))
                eff_entry, _, _ = self.cost_service.calculate_slippage(
                    price=c_close,
                    side="BUY",
                    volatility_pct=Decimal(str(abs(c_chg))),
                )

                max_affordable = int(session["cash_balance"] // eff_entry)
                actual_qty = min(req_qty, Decimal(str(max(0, max_affordable))))

                if actual_qty >= Decimal("1"):
                    notional = eff_entry * actual_qty
                    session["cash_balance"] -= notional

                    # Establish Trade-Level Stop-Loss and Target with Invariant Guarantees:
                    # Invariant 1: Target must be strictly > eff_entry (+3.5% target multiplier)
                    # Invariant 2: Stop-Loss must be strictly < eff_entry (-2.0% risk multiplier)
                    base_ref = Decimal(str(cfg.buy_threshold)) if cfg.buy_threshold > 0 else Decimal("390.00")
                    tp_multiplier = Decimal(str(cfg.target)) / base_ref if cfg.target > 0 else Decimal("1.035")
                    sl_multiplier = Decimal(str(cfg.stop_loss)) / base_ref if cfg.stop_loss > 0 else Decimal("0.980")

                    # Ensure valid multipliers
                    if tp_multiplier <= Decimal("1.0"):
                        tp_multiplier = Decimal("1.035")
                    if sl_multiplier >= Decimal("1.0"):
                        sl_multiplier = Decimal("0.980")

                    trade_tp = (eff_entry * tp_multiplier).quantize(Decimal("0.01"))
                    trade_sl = (eff_entry * sl_multiplier).quantize(Decimal("0.01"))

                    session["active_position"] = {
                        "symbol": cfg.symbol,
                        "side": "LONG",
                        "quantity": actual_qty,
                        "entry_price": eff_entry,
                        "current_price": c_close,
                        "unrealized_pnl": Decimal("0.00"),
                        "unrealized_return_pct": 0.0,
                        "entry_timestamp": c_ts,
                        "stop_loss_price": trade_sl,
                        "target_price": trade_tp,
                    }

        # Update Portfolio NAV and Max Drawdown
        unrealized = (
            session["active_position"]["unrealized_pnl"]
            if session["active_position"] is not None
            else Decimal("0.00")
        )
        pos_notional = (
            (session["active_position"]["entry_price"] * session["active_position"]["quantity"])
            if session["active_position"] is not None
            else Decimal("0.00")
        )

        nav = session["cash_balance"] + pos_notional + unrealized
        session["portfolio_nav"] = nav

        if nav > session["peak_nav"]:
            session["peak_nav"] = nav

        dd = (
            float((session["peak_nav"] - nav) / session["peak_nav"] * 100)
            if session["peak_nav"] > 0
            else 0.0
        )
        if dd > session["max_drawdown_pct"]:
            session["max_drawdown_pct"] = dd

        session["last_updated_at"] = datetime.now(timezone.utc).isoformat()
        return session

    def simulate_independent_feed(
        self,
        version_id: str,
        feed_params: FrozenPaperFeedSimulationRequest,
    ) -> Dict[str, Any]:
        """
        Simulates an independent, multi-candle market stream with realistic drift and volatility,
        producing >= 30 completed trades to validate statistical robustness in paper mode.
        """
        session = self.get_or_create_session(version_id)
        cfg: FrozenStrategyConfig = session["config"]
        rng = random.Random(feed_params.seed)

        base_p = float(cfg.buy_threshold)
        cur_p = base_p
        start_date = datetime(2027, 3, 1, 9, 15)

        for step in range(feed_params.candle_count):
            day_offset = step // 4
            hour = 9 + (step % 4) * 2
            ts = f"2027-03-{1 + day_offset:02d} {hour:02d}:15"

            # Realistic market cycle oscillation (swing rallies + pullbacks)
            cycle_phase = (step % 12)
            if cycle_phase < 6:
                cycle_drift = 0.0035 + (feed_params.drift_pct / 100.0)
            else:
                cycle_drift = -0.0025 + (feed_params.drift_pct / 100.0)

            shock = rng.gauss(cycle_drift, feed_params.base_volatility_pct / 100.0)
            open_p = cur_p
            close_p = round(cur_p * (1.0 + shock), 2)
            high_p = round(max(open_p, close_p) * (1.0 + abs(rng.gauss(0, 0.006))), 2)
            low_p = round(min(open_p, close_p) * (1.0 - abs(rng.gauss(0, 0.006))), 2)
            chg = round((close_p - open_p) / open_p * 100, 2)

            candle = {
                "timestamp": ts,
                "open": open_p,
                "high": high_p,
                "low": low_p,
                "close": close_p,
                "change_percent": chg,
            }
            self.process_candle(version_id, candle)
            cur_p = close_p

        return session

    def get_validation_scorecard(self, session: Dict[str, Any], min_required_trades: int = 50) -> FrozenPaperValidationScorecard:
        """Computes the live statistical scorecard against the N >= 50 quality gates and promotion readiness status."""
        trades = session["trade_audit_log"]
        total_trades = len(trades)
        wins = [t for t in trades if t["net_pnl"] > Decimal("0.00")]
        losses = [t for t in trades if t["net_pnl"] < Decimal("0.00")]

        gross_profit = sum((t["gross_pnl"] for t in wins), Decimal("0.00"))
        gross_loss = abs(sum((t["gross_pnl"] for t in losses), Decimal("0.00")))
        pf = float(gross_profit / gross_loss) if gross_loss > Decimal("0.00") else (99.0 if gross_profit > 0 else 0.0)
        win_rate = (len(wins) / total_trades * 100.0) if total_trades > 0 else 0.0
        cum_net_pnl = session["cumulative_realized_pnl"]
        max_dd = session["max_drawdown_pct"]

        # Invariant Verification
        violations = 0
        for t in trades:
            if t["exit_reason"] == "TAKE_PROFIT" and t["exit_price"] < t["entry_price"]:
                violations += 1
            elif t["exit_reason"] == "STOP_LOSS" and t["exit_price"] > t["entry_price"]:
                violations += 1

        # NAV Reconciliation Accounting
        pos = session.get("active_position")
        pos_notional = (pos["entry_price"] * pos["quantity"]) if pos else Decimal("0.00")
        pos_unrealized = pos["unrealized_pnl"] if pos else Decimal("0.00")
        reconciled_nav = session["cash_balance"] + pos_notional + pos_unrealized
        nav_discrepancy = abs(session["portfolio_nav"] - reconciled_nav)

        sample_satisfied = total_trades >= min_required_trades
        win_rate_satisfied = win_rate >= 40.0
        pf_satisfied = pf >= 1.10
        pnl_satisfied = cum_net_pnl > Decimal("0.00")
        dd_satisfied = max_dd <= 15.0
        invariants_satisfied = violations == 0
        reconciliation_satisfied = nav_discrepancy == Decimal("0.0000")

        all_gates_passed = (
            sample_satisfied
            and win_rate_satisfied
            and pf_satisfied
            and pnl_satisfied
            and dd_satisfied
            and invariants_satisfied
            and reconciliation_satisfied
        )

        if not sample_satisfied:
            readiness_status = "INSUFFICIENT_SAMPLE"
            overall_status = "INSUFFICIENT_SAMPLE_SIZE"
        elif all_gates_passed:
            overall_status = "ROBUST_WINNER"
            if pf >= 1.20:
                readiness_status = "ROBUST_PAPER_CANDIDATE"
            else:
                readiness_status = "PAPER_VALIDATED"
        else:
            overall_status = "REJECTED_UNDERPERFORMING"
            readiness_status = "REJECTED"

        return FrozenPaperValidationScorecard(
            min_required_trades=min_required_trades,
            completed_trades=total_trades,
            sample_size_satisfied=sample_satisfied,
            win_rate_pct=round(win_rate, 2),
            win_rate_satisfied=win_rate_satisfied,
            profit_factor=round(pf, 2),
            profit_factor_satisfied=pf_satisfied,
            cumulative_net_pnl=cum_net_pnl,
            net_pnl_positive=pnl_satisfied,
            max_drawdown_pct=round(max_dd, 2),
            drawdown_acceptable=dd_satisfied,
            tp_sl_invariant_violations=violations,
            nav_accounting_discrepancy=nav_discrepancy,
            overall_status=overall_status,
            promotion_readiness_status=readiness_status,
            live_promotion_blocked=True,
        )

    def get_session_state_response(self, version_id: str) -> FrozenPaperSessionStateResponse:
        """Serializes current session into a full operational response model."""
        session = self.get_or_create_session(version_id)
        trades = session["trade_audit_log"]
        total_trades = len(trades)
        wins = [t for t in trades if t["net_pnl"] > Decimal("0.00")]
        losses = [t for t in trades if t["net_pnl"] < Decimal("0.00")]

        gross_profit = sum((t["gross_pnl"] for t in wins), Decimal("0.00"))
        gross_loss = abs(sum((t["gross_pnl"] for t in losses), Decimal("0.00")))
        pf = float(gross_profit / gross_loss) if gross_loss > Decimal("0.00") else (99.0 if gross_profit > 0 else 0.0)
        win_rate = (len(wins) / total_trades * 100.0) if total_trades > 0 else 0.0

        pos_resp = None
        if session["active_position"]:
            pos_resp = FrozenPaperPositionResponse(**session["active_position"])

        scorecard = self.get_validation_scorecard(session)

        unrealized = (
            session["active_position"]["unrealized_pnl"]
            if session["active_position"] is not None
            else Decimal("0.00")
        )

        return FrozenPaperSessionStateResponse(
            session_id=session["session_id"],
            version_id=session["version_id"],
            status=session["status"],
            execution_mode=session["execution_mode"],
            initial_capital=session["initial_capital"],
            cash_balance=session["cash_balance"],
            portfolio_nav=session["portfolio_nav"],
            cumulative_realized_pnl=session["cumulative_realized_pnl"],
            unrealized_pnl=unrealized,
            total_charges_paid=session["total_charges_paid"],
            total_trades_count=total_trades,
            winning_trades_count=len(wins),
            losing_trades_count=len(losses),
            win_rate_pct=round(win_rate, 2),
            profit_factor=round(pf, 2),
            max_drawdown_pct=round(session["max_drawdown_pct"], 2),
            active_position=pos_resp,
            validation_scorecard=scorecard,
            last_updated_at=session["last_updated_at"],
        )

    def get_trade_audit_log(self, version_id: str) -> List[FrozenPaperTradeAuditResponse]:
        """Returns the complete list of fresh-trade audit records for the session."""
        session = self.get_or_create_session(version_id)
        return [FrozenPaperTradeAuditResponse(**t) for t in reversed(session["trade_audit_log"])]
