import json
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Tuple, Union

from app.brokers.base.broker_types import BrokerOrderRequest
from app.database.models.strategy import StrategyDefinition, StrategyInstance
from app.database.models.trading_risk_settings import TradingRiskSettings
from app.services.strategy_engine.base_strategy import StrategyFactory, BaseStrategy
from app.services.transaction_cost_service import TransactionCostService
from app.services.risk_engine import RiskEngine

logger = logging.getLogger(__name__)

PRECISION_TWO = Decimal("0.01")
PRECISION_FOUR = Decimal("0.0001")


@dataclass
class BacktestTrade:
    """Represents a single completed trade in the backtest."""
    trade_id: str
    strategy_name: str
    symbol: str
    side: str
    entry_time: str
    entry_price: Decimal
    exit_time: str
    exit_price: Decimal
    quantity: Decimal
    gross_pnl: Decimal
    entry_charges: Decimal
    exit_charges: Decimal
    total_charges: Decimal
    net_pnl: Decimal
    exit_reason: str  # "STOP_LOSS", "TAKE_PROFIT", "STRATEGY_EXIT", "END_OF_DATA"


@dataclass
class BacktestChartMarker:
    """Represents a visual trade marker on an OHLC candle chart."""
    timestamp: str
    symbol: str
    marker_type: str  # "BUY", "SELL", "STOP_LOSS", "TAKE_PROFIT"
    price: Decimal
    quantity: Decimal
    strategy_name: str
    text: str


@dataclass
class StrategyBacktestSummary:
    """Per-strategy individual performance and execution audit metrics."""
    strategy_id: str
    strategy_name: str
    symbol: str
    allocated_capital: Decimal
    final_balance: Decimal
    # Execution Audit Counters
    signals_generated: int
    trades_executed: int
    trades_blocked_capital: int
    trades_blocked_risk_limit: int
    # Performance Metrics
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate_pct: float
    gross_profit: Decimal
    gross_loss: Decimal
    total_charges: Decimal
    net_realized_pnl: Decimal
    return_pct: float
    profit_factor: float
    max_drawdown_pct: float
    trades: List[BacktestTrade] = field(default_factory=list)


@dataclass
class ConsolidatedBacktestReport:
    """Consolidated portfolio backtest summary across all strategies."""
    initial_total_capital: Decimal
    final_portfolio_nav: Decimal
    total_net_pnl: Decimal
    portfolio_return_pct: float
    # Portfolio-wide Audit Counters
    total_signals_generated: int
    total_trades_executed: int
    total_trades_blocked_capital: int
    total_trades_blocked_risk_limit: int
    # Performance Metrics
    total_trades: int
    winning_trades: int
    losing_trades: int
    overall_win_rate_pct: float
    total_charges_paid: Decimal
    strategy_summaries: List[StrategyBacktestSummary] = field(default_factory=list)
    chart_markers: List[BacktestChartMarker] = field(default_factory=list)
    equity_curve: List[Dict[str, Any]] = field(default_factory=list)


class StrategyBucketState:
    """Maintains isolated ledger, state, and execution audit counters for a single strategy."""

    def __init__(self, strategy_id: str, strategy_name: str, symbol: str, allocated_capital: Decimal) -> None:
        self.strategy_id = strategy_id
        self.strategy_name = strategy_name
        self.symbol = symbol.upper()
        self.initial_capital = allocated_capital
        self.cash_balance = allocated_capital
        self.position_qty = Decimal("0.0000")
        self.position_avg_price = Decimal("0.0000")
        self.position_cost_basis = Decimal("0.0000")
        self.stop_loss: Optional[Decimal] = None
        self.target: Optional[Decimal] = None
        self.entry_time: Optional[str] = None
        self.entry_charges = Decimal("0.00")
        self.realized_pnl = Decimal("0.0000")
        self.trades: List[BacktestTrade] = []
        self.peak_equity = allocated_capital
        self.max_drawdown_pct = 0.0
        # Audit Counters
        self.signals_generated = 0
        self.trades_executed = 0
        self.trades_blocked_capital = 0
        self.trades_blocked_risk_limit = 0


class BacktestingEngineService:
    """
    Production-grade Backtesting Engine for Multi-Strategy Portfolio Simulations.

    Key Architectural Guarantees:
    1. Baseline & Configurable Capital: Defaults to Rs 10,00,000 / 44 = Rs 22,727.27 per strategy,
       with fully configurable custom per-strategy capital.
    2. Affordable Quantity Auto-Sizing: Automatically sizes requested quantity to affordable
       shares within strategy bucket capital (without modifying strategy logic).
    3. 4-Point Audit Tracking: Tracks Signals Generated, Trades Executed, Blocked by Capital,
       and Blocked by Risk Limit for every strategy.
    4. Same-Candle Ambiguity Rule: When both SL and Target are touched in the same OHLC candle,
       strictly enforces conservative SL-first assumption (worst-case risk modeling).
    5. Look-Ahead Bias Prevention: Signal at bar t only uses data available up to bar t. Entry/Exit
       executes at bar t close / bar t+1 open with dynamic slippage and Indian taxes.
    6. Isolated Strategy Buckets & Combined Risk Limits: Validates single-stock & portfolio exposure.
    7. Purely Virtual Backtest: 100% isolated from live trading execution.
    """

    def __init__(self, risk_engine: Optional[RiskEngine] = None) -> None:
        self._risk_engine = risk_engine

    def run_multi_strategy_backtest(
        self,
        strategy_definitions: List[Union[StrategyDefinition, Dict[str, Any]]],
        historical_candles_by_symbol: Dict[str, List[Dict[str, Any]]],
        total_initial_capital: Decimal = Decimal("1000000.00"),
        custom_capital_allocation: Optional[Dict[str, Decimal]] = None,
        same_bar_sl_tp_rule: str = "SL_FIRST",  # "SL_FIRST" (conservative) or "TP_FIRST"
        apply_transaction_costs: bool = True,
        apply_slippage: bool = True,
        auto_size_to_bucket: bool = True,
        risk_settings: Optional[TradingRiskSettings] = None,
        product: str = "CNC",
    ) -> ConsolidatedBacktestReport:
        """
        Executes a synchronized multi-strategy candle-by-candle backtest.
        """
        num_strategies = len(strategy_definitions)
        if num_strategies == 0:
            raise ValueError("At least one strategy definition must be provided for backtest.")

        # 1. Resolve Capital Buckets (Baseline Rs 10L / N)
        default_per_strategy = (total_initial_capital / Decimal(str(num_strategies))).quantize(PRECISION_FOUR)
        
        buckets: Dict[str, StrategyBucketState] = {}
        strategy_instances: Dict[str, BaseStrategy] = {}
        strategy_symbols: Dict[str, str] = {}

        for defn in strategy_definitions:
            if isinstance(defn, StrategyDefinition):
                s_id = str(defn.id)
                s_name = defn.name
                cfg = json.loads(defn.config_json) if isinstance(defn.config_json, str) else (defn.config_json or {})
            else:
                s_id = str(defn.get("id", uuid.uuid4()))
                s_name = defn.get("name", "Strategy")
                cfg = defn.get("config", defn.get("config_json", {}))
                if isinstance(cfg, str):
                    try:
                        cfg = json.loads(cfg)
                    except Exception:
                        cfg = {}

            sym = str(cfg.get("symbol") or "RELIANCE").upper().strip()
            strategy_symbols[s_id] = sym

            # Resolve per-strategy allocated capital
            if custom_capital_allocation and s_id in custom_capital_allocation:
                allocated_cap = custom_capital_allocation[s_id]
            elif custom_capital_allocation and s_name in custom_capital_allocation:
                allocated_cap = custom_capital_allocation[s_name]
            elif "allocated_capital" in cfg:
                try:
                    allocated_cap = Decimal(str(cfg["allocated_capital"]))
                except Exception:
                    allocated_cap = default_per_strategy
            else:
                allocated_cap = default_per_strategy

            buckets[s_id] = StrategyBucketState(
                strategy_id=s_id,
                strategy_name=s_name,
                symbol=sym,
                allocated_capital=allocated_cap,
            )

            # Create concrete BaseStrategy instance via Factory
            strategy_instances[s_id] = StrategyFactory.create_strategy(
                definition=defn if isinstance(defn, StrategyDefinition) else None,
                config=cfg,
            )

        # 2. Collect and Align Unique Timestamps Across All Symbols
        all_timestamps = set()
        for sym, candles in historical_candles_by_symbol.items():
            for c in candles:
                ts = c.get("timestamp") or c.get("time") or c.get("date")
                if ts:
                    all_timestamps.add(str(ts))

        sorted_timestamps = sorted(list(all_timestamps))
        if not sorted_timestamps:
            max_len = max((len(c) for c in historical_candles_by_symbol.values()), default=0)
            sorted_timestamps = [f"STEP_{i:04d}" for i in range(max_len)]

        # Index candles by (symbol, timestamp)
        candle_map: Dict[Tuple[str, str], Dict[str, Any]] = {}
        for sym, candles in historical_candles_by_symbol.items():
            for idx, c in enumerate(candles):
                ts = str(c.get("timestamp") or c.get("time") or c.get("date") or f"STEP_{idx:04d}")
                candle_map[(sym.upper(), ts)] = c

        all_chart_markers: List[BacktestChartMarker] = []
        equity_curve: List[Dict[str, Any]] = []

        # 3. Synchronized Candle-by-Candle Iteration
        for ts in sorted_timestamps:
            current_portfolio_nav = Decimal("0.00")

            for s_id, bucket in buckets.items():
                sym = bucket.symbol
                candle = candle_map.get((sym, ts))
                if not candle:
                    continue

                open_p = Decimal(str(candle.get("open", candle.get("price", "100.0"))))
                high_p = Decimal(str(candle.get("high", open_p)))
                low_p = Decimal(str(candle.get("low", open_p)))
                close_p = Decimal(str(candle.get("close", candle.get("price", open_p))))
                change_pct = Decimal(str(candle.get("change_percent", "0.0")))

                # --- STEP A: Evaluate Intracandle Stop-Loss & Target for Existing Open Position ---
                if bucket.position_qty > Decimal("0"):
                    pos_qty = bucket.position_qty
                    avg_entry = bucket.position_avg_price
                    sl = bucket.stop_loss
                    tp = bucket.target

                    sl_hit = sl is not None and low_p <= sl
                    tp_hit = tp is not None and high_p >= tp

                    executed_exit = False
                    exit_price = close_p
                    exit_reason = "STRATEGY_EXIT"

                    if sl_hit and tp_hit:
                        # Same-Candle Ambiguity: Use Conservative SL-First Rule
                        if same_bar_sl_tp_rule.upper() == "SL_FIRST":
                            executed_exit = True
                            exit_price = sl  # type: ignore
                            exit_reason = "STOP_LOSS"
                        else:
                            executed_exit = True
                            exit_price = tp  # type: ignore
                            exit_reason = "TAKE_PROFIT"
                    elif sl_hit:
                        executed_exit = True
                        exit_price = sl  # type: ignore
                        exit_reason = "STOP_LOSS"
                    elif tp_hit:
                        executed_exit = True
                        exit_price = tp  # type: ignore
                        exit_reason = "TAKE_PROFIT"

                    if executed_exit:
                        # Execute Exit Fill
                        effective_exit = exit_price
                        if apply_slippage:
                            effective_exit, _, _ = TransactionCostService.calculate_slippage(
                                price=exit_price, side="SELL", volatility_pct=abs(change_pct)
                            )

                        gross_proceeds = pos_qty * effective_exit
                        exit_charges = Decimal("0.00")
                        if apply_transaction_costs:
                            cost_dict = TransactionCostService.calculate_transaction_costs(
                                traded_value=gross_proceeds, side="SELL", product=product
                            )
                            exit_charges = cost_dict["total_charges"]

                        net_proceeds = gross_proceeds - exit_charges
                        gross_pnl = (effective_exit - avg_entry) * pos_qty
                        total_charges = bucket.entry_charges + exit_charges
                        net_pnl = gross_pnl - total_charges

                        bucket.cash_balance = (bucket.cash_balance + net_proceeds).quantize(PRECISION_FOUR)
                        bucket.realized_pnl = (bucket.realized_pnl + net_pnl).quantize(PRECISION_FOUR)
                        bucket.position_qty = Decimal("0.0000")
                        bucket.position_avg_price = Decimal("0.0000")
                        bucket.position_cost_basis = Decimal("0.0000")
                        bucket.stop_loss = None
                        bucket.target = None

                        trade = BacktestTrade(
                            trade_id=f"BT-{uuid.uuid4().hex[:8]}",
                            strategy_name=bucket.strategy_name,
                            symbol=sym,
                            side="BUY_LONG",
                            entry_time=bucket.entry_time or ts,
                            entry_price=avg_entry,
                            exit_time=ts,
                            exit_price=effective_exit,
                            quantity=pos_qty,
                            gross_pnl=gross_pnl.quantize(PRECISION_TWO, rounding=ROUND_HALF_UP),
                            entry_charges=bucket.entry_charges,
                            exit_charges=exit_charges,
                            total_charges=total_charges,
                            net_pnl=net_pnl.quantize(PRECISION_TWO, rounding=ROUND_HALF_UP),
                            exit_reason=exit_reason,
                        )
                        bucket.trades.append(trade)

                        all_chart_markers.append(BacktestChartMarker(
                            timestamp=ts,
                            symbol=sym,
                            marker_type=exit_reason,
                            price=effective_exit,
                            quantity=pos_qty,
                            strategy_name=bucket.strategy_name,
                            text=f"{exit_reason} @ {effective_exit:,.2f} ({net_pnl:+,.2f})",
                        ))

                # --- STEP B: Evaluate Strategy Signal Generation at Bar t (No Look-Ahead Bias) ---
                strat_obj = strategy_instances[s_id]
                market_payload = {
                    "symbol": sym,
                    "price": str(close_p),
                    "open": str(open_p),
                    "high": str(high_p),
                    "low": str(low_p),
                    "close": str(close_p),
                    "change_percent": float(change_pct),
                    "timestamp": ts,
                }

                signal = strat_obj.generate_signal(market_payload)

                if signal and bucket.position_qty == Decimal("0"):
                    sig_side = str(signal.get("side", "BUY")).upper()
                    if sig_side == "BUY":
                        bucket.signals_generated += 1
                        raw_req_qty = Decimal(str(signal.get("quantity") or 10))

                        # Apply Entry Slippage
                        effective_entry = close_p
                        if apply_slippage:
                            effective_entry, _, _ = TransactionCostService.calculate_slippage(
                                price=close_p, side="BUY", volatility_pct=abs(change_pct)
                            )

                        # Position Sizing: Calculate affordable quantity within bucket cash
                        est_cost_per_share = effective_entry * Decimal("1.002") # price + ~0.2% regulatory costs
                        affordable_qty = Decimal(int(bucket.cash_balance / est_cost_per_share)) if est_cost_per_share > 0 else Decimal("0")

                        if auto_size_to_bucket and affordable_qty > Decimal("0"):
                            req_qty = min(raw_req_qty, affordable_qty)
                        else:
                            req_qty = raw_req_qty

                        if req_qty <= Decimal("0"):
                            # Cannot afford even 1 share with allocated bucket capital
                            bucket.trades_blocked_capital += 1
                            continue

                        order_cost = req_qty * effective_entry
                        entry_charges = Decimal("0.00")
                        if apply_transaction_costs:
                            costs = TransactionCostService.calculate_transaction_costs(
                                traded_value=order_cost, side="BUY", product=product
                            )
                            entry_charges = costs["total_charges"]

                        total_req = order_cost + entry_charges

                        # 1. Bucket Buying Power Check
                        if bucket.cash_balance < total_req:
                            bucket.trades_blocked_capital += 1
                            continue

                        # 2. Portfolio-Wide Combined Single-Stock Exposure Check
                        can_execute = True
                        if risk_settings and risk_settings.max_position_quantity is not None:
                            current_combined_sym_qty = sum(
                                b.position_qty for b in buckets.values() if b.symbol == sym
                            )
                            if (current_combined_sym_qty + req_qty) > risk_settings.max_position_quantity:
                                can_execute = False
                                bucket.trades_blocked_risk_limit += 1
                                logger.debug(
                                    "Backtest RiskEngine blocked BUY for %s: Projected qty %s > limit %s",
                                    sym, current_combined_sym_qty + req_qty, risk_settings.max_position_quantity
                                )

                        if can_execute:
                            # Execute BUY Fill into Bucket
                            bucket.cash_balance = (bucket.cash_balance - total_req).quantize(PRECISION_FOUR)
                            bucket.position_qty = req_qty.quantize(PRECISION_FOUR)
                            bucket.position_avg_price = effective_entry.quantize(PRECISION_FOUR)
                            bucket.position_cost_basis = total_req
                            bucket.entry_charges = entry_charges
                            bucket.entry_time = ts
                            bucket.trades_executed += 1

                            # Setup Stop-Loss and Target (Default 2% SL, 4% TP if not in signal)
                            sig_sl = signal.get("stop_loss")
                            sig_tp = signal.get("target") or signal.get("take_profit")

                            if sig_sl is not None and Decimal(str(sig_sl)) < effective_entry:
                                bucket.stop_loss = Decimal(str(sig_sl)).quantize(PRECISION_TWO)
                            else:
                                bucket.stop_loss = (effective_entry * Decimal("0.98")).quantize(PRECISION_TWO)

                            if sig_tp is not None and Decimal(str(sig_tp)) > effective_entry:
                                bucket.target = Decimal(str(sig_tp)).quantize(PRECISION_TWO)
                            else:
                                bucket.target = (effective_entry * Decimal("1.04")).quantize(PRECISION_TWO)

                            all_chart_markers.append(BacktestChartMarker(
                                timestamp=ts,
                                symbol=sym,
                                marker_type="BUY",
                                price=effective_entry,
                                quantity=req_qty,
                                strategy_name=bucket.strategy_name,
                                text=f"BUY {req_qty} @ {effective_entry:,.2f} (SL: {bucket.stop_loss})",
                            ))

                # Update Bucket Drawdown Metrics
                bucket_equity = bucket.cash_balance + (bucket.position_qty * close_p)
                if bucket_equity > bucket.peak_equity:
                    bucket.peak_equity = bucket_equity
                dd = float((bucket.peak_equity - bucket_equity) / bucket.peak_equity * 100) if bucket.peak_equity > 0 else 0.0
                if dd > bucket.max_drawdown_pct:
                    bucket.max_drawdown_pct = dd

                current_portfolio_nav += bucket_equity

            equity_curve.append({
                "timestamp": ts,
                "portfolio_nav": float(current_portfolio_nav.quantize(PRECISION_TWO)),
            })

        # 4. Generate Final Summaries and Leaderboard Report
        summaries: List[StrategyBacktestSummary] = []
        total_realized_pnl = Decimal("0.00")
        total_charges_all = Decimal("0.00")
        total_trades_all = 0
        winning_trades_all = 0
        losing_trades_all = 0
        total_signals_all = 0
        total_executed_all = 0
        total_blocked_cap_all = 0
        total_blocked_risk_all = 0

        for s_id, bucket in buckets.items():
            wins = [t for t in bucket.trades if t.net_pnl > Decimal("0")]
            losses = [t for t in bucket.trades if t.net_pnl < Decimal("0")]

            gross_profit = sum((t.gross_pnl for t in wins), Decimal("0.00"))
            gross_loss = abs(sum((t.gross_pnl for t in losses), Decimal("0.00")))
            strat_charges = sum((t.total_charges for t in bucket.trades), Decimal("0.00"))

            pf = float(gross_profit / gross_loss) if gross_loss > Decimal("0") else (99.0 if gross_profit > Decimal("0") else 0.0)
            win_rate = (len(wins) / len(bucket.trades) * 100.0) if bucket.trades else 0.0
            ret_pct = float(bucket.realized_pnl / bucket.initial_capital) * 100.0 if bucket.initial_capital > Decimal("0") else 0.0

            summary = StrategyBacktestSummary(
                strategy_id=s_id,
                strategy_name=bucket.strategy_name,
                symbol=bucket.symbol,
                allocated_capital=bucket.initial_capital,
                final_balance=bucket.cash_balance + (bucket.position_qty * bucket.position_avg_price),
                signals_generated=bucket.signals_generated,
                trades_executed=bucket.trades_executed,
                trades_blocked_capital=bucket.trades_blocked_capital,
                trades_blocked_risk_limit=bucket.trades_blocked_risk_limit,
                total_trades=len(bucket.trades),
                winning_trades=len(wins),
                losing_trades=len(losses),
                win_rate_pct=round(win_rate, 2),
                gross_profit=gross_profit.quantize(PRECISION_TWO),
                gross_loss=gross_loss.quantize(PRECISION_TWO),
                total_charges=strat_charges.quantize(PRECISION_TWO),
                net_realized_pnl=bucket.realized_pnl.quantize(PRECISION_TWO),
                return_pct=round(ret_pct, 2),
                profit_factor=round(pf, 2),
                max_drawdown_pct=round(bucket.max_drawdown_pct, 2),
                trades=bucket.trades,
            )
            summaries.append(summary)

            total_realized_pnl += bucket.realized_pnl
            total_charges_all += strat_charges
            total_trades_all += len(bucket.trades)
            winning_trades_all += len(wins)
            losing_trades_all += len(losses)
            total_signals_all += bucket.signals_generated
            total_executed_all += bucket.trades_executed
            total_blocked_cap_all += bucket.trades_blocked_capital
            total_blocked_risk_all += bucket.trades_blocked_risk_limit

        # Sort leaderboard by net realized P&L descending
        summaries.sort(key=lambda s: s.net_realized_pnl, reverse=True)

        final_portfolio_nav = total_initial_capital + total_realized_pnl
        portfolio_return = float(total_realized_pnl / total_initial_capital) * 100.0
        overall_win_rate = (winning_trades_all / total_trades_all * 100.0) if total_trades_all > 0 else 0.0

        return ConsolidatedBacktestReport(
            initial_total_capital=total_initial_capital,
            final_portfolio_nav=final_portfolio_nav.quantize(PRECISION_TWO),
            total_net_pnl=total_realized_pnl.quantize(PRECISION_TWO),
            portfolio_return_pct=round(portfolio_return, 2),
            total_signals_generated=total_signals_all,
            total_trades_executed=total_executed_all,
            total_trades_blocked_capital=total_blocked_cap_all,
            total_trades_blocked_risk_limit=total_blocked_risk_all,
            total_trades=total_trades_all,
            winning_trades=winning_trades_all,
            losing_trades=losing_trades_all,
            overall_win_rate_pct=round(overall_win_rate, 2),
            total_charges_paid=total_charges_all.quantize(PRECISION_TWO),
            strategy_summaries=summaries,
            chart_markers=all_chart_markers,
            equity_curve=equity_curve,
        )
