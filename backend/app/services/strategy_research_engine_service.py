import copy
import json
import logging
import uuid
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple, Union

from app.database.models.trading_risk_settings import TradingRiskSettings
from app.services.backtesting_engine_service import (
    BacktestingEngineService,
    ConsolidatedBacktestReport,
    StrategyBacktestSummary,
    BacktestTrade,
)

logger = logging.getLogger(__name__)

PRECISION_TWO = Decimal("0.01")
PRECISION_FOUR = Decimal("0.0001")


@dataclass
class OptimizationCandidate:
    """Represents a set of candidate parameters and regime filters evaluated during optimization."""
    param_id: str
    target_multiplier: float  # e.g. 1.035, 1.050
    stop_loss_multiplier: float  # e.g. 0.975, 0.985
    use_trend_filter: bool  # True: block BUY if short-term change is negative or downtrend
    use_volatility_filter: bool  # True: block BUY during high adverse intraday volatility (>3.5%)
    min_change_percent: float = 0.0


@dataclass
class RollingWindowResult:
    """Stores performance of a single rolling walk-forward window."""
    window_id: str
    window_name: str
    is_pnl: Decimal
    oos_pnl: Decimal
    oos_trades: int
    oos_wins: int
    oos_losses: int
    oos_win_rate_pct: float
    oos_profit_factor: float
    oos_max_drawdown_pct: float
    passed: bool
    fail_reasons: List[str] = field(default_factory=list)


@dataclass
class MultiWindowStrategyReport:
    """Multi-window rolling Walk-Forward validation report for a single strategy."""
    strategy_id: str
    strategy_name: str
    symbol: str
    total_oos_trades: int
    total_oos_wins: int
    total_oos_losses: int
    overall_win_rate_pct: float
    total_gross_profit: Decimal
    total_gross_loss: Decimal
    overall_profit_factor: float
    cumulative_net_pnl: Decimal
    overall_max_drawdown_pct: float
    avg_trade_net_pnl: Decimal
    windows_passed: int
    windows_total: int
    consistency_score_pct: float
    robustness_status: str  # "ROBUST_WINNER", "REJECTED_INCONSISTENT", "REJECTED_NEGATIVE_PNL", "INSUFFICIENT_SAMPLE_SIZE"
    rejection_reasons: List[str] = field(default_factory=list)
    window_details: List[RollingWindowResult] = field(default_factory=list)
    best_candidate: Optional[OptimizationCandidate] = None
    versioned_optimized_config: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MultiWindowConsolidatedReport:
    """Consolidated portfolio report across all strategies over multi-window rolling WFA."""
    total_strategies: int
    robust_strategies_count: int
    inconsistent_strategies_count: int
    insufficient_sample_count: int
    total_portfolio_initial_capital: Decimal
    final_portfolio_nav: Decimal
    cumulative_net_pnl: Decimal
    overall_return_pct: float
    total_oos_trades_all: int
    overall_portfolio_win_rate_pct: float
    strategy_reports: List[MultiWindowStrategyReport] = field(default_factory=list)
    versioned_optimized_strategies: List[Dict[str, Any]] = field(default_factory=list)


class StrategyResearchEngineService:
    """
    Quantitative Strategy Research & Multi-Window Rolling Walk-Forward Optimization Engine.

    Guarantees:
    1. Multi-Window Rolling Walk-Forward Analysis: Tests across sequential rolling windows.
    2. Strict In-Sample Exploration: Parameters & regime filters are tested strictly on IS data per window.
    3. Large Sample Size Aggregation: Evaluates $N \ge 30$ completed trades per strategy.
    4. Multi-Window Consistency Gate: Strategy is robust ONLY IF it consistently passes across multiple
       independent unseen windows (e.g. $\ge 75\%$ pass rate).
    5. Zero Data Leakage: Out-of-sample data is never used during parameter tuning.
    6. Preserves Original 44 Strategies: Original strategy configs remain untouched; optimized
       configurations are stored separately as versioned research artifacts.
    7. Pure Virtual Isolation: 100% isolated from live trading execution.
    """

    def __init__(self, backtest_service: Optional[BacktestingEngineService] = None) -> None:
        self._backtest_service = backtest_service or BacktestingEngineService()

    def generate_candidate_grid(self) -> List[OptimizationCandidate]:
        """Generates the parameter and regime filter exploration grid."""
        candidates: List[OptimizationCandidate] = []
        tp_multipliers = [1.035, 1.050]
        sl_multipliers = [0.975, 0.985]
        trend_filters = [True, False]
        vol_filters = [True, False]

        idx = 1
        for tp in tp_multipliers:
            for sl in sl_multipliers:
                for tf in trend_filters:
                    for vf in vol_filters:
                        candidates.append(OptimizationCandidate(
                            param_id=f"GRID_{idx:02d}",
                            target_multiplier=tp,
                            stop_loss_multiplier=sl,
                            use_trend_filter=tf,
                            use_volatility_filter=vf,
                            min_change_percent=0.2 if tf else -99.0,
                        ))
                        idx += 1
        return candidates

    def apply_candidate_to_strategy_config(
        self,
        base_config: Dict[str, Any],
        candidate: OptimizationCandidate,
        base_price: float,
    ) -> Dict[str, Any]:
        """Applies candidate parameters and regime filters to strategy config as a new versioned copy."""
        new_cfg = copy.deepcopy(base_config)
        new_cfg["stop_loss"] = round(base_price * candidate.stop_loss_multiplier, 2)
        new_cfg["target"] = round(base_price * candidate.target_multiplier, 2)
        if candidate.use_trend_filter:
            new_cfg["buy_threshold"] = round(base_price * 1.002, 2)
            new_cfg["change_percent_threshold"] = candidate.min_change_percent
        if candidate.use_volatility_filter:
            new_cfg["max_adverse_volatility"] = 3.5
        new_cfg["research_version"] = f"WFA_ROLLING_{candidate.param_id}"
        return new_cfg

    def run_multi_window_rolling_wfa(
        self,
        strategy_definitions: List[Dict[str, Any]],
        rolling_windows_data: List[Dict[str, Any]],
        total_initial_capital: Decimal = Decimal("1000000.00"),
        min_total_oos_trades: int = 30,
        min_window_pass_ratio: float = 0.75,
        risk_settings: Optional[TradingRiskSettings] = None,
    ) -> MultiWindowConsolidatedReport:
        """
        Executes Multi-Window Rolling Walk-Forward Analysis across sequential market regimes:
        - rolling_windows_data: List of dicts with {"window_id", "name", "is_candles", "oos_candles"}
        """
        num_strategies = len(strategy_definitions)
        per_strat_capital = (total_initial_capital / Decimal(str(num_strategies))).quantize(PRECISION_FOUR)
        grid = self.generate_candidate_grid()

        strategy_reports: List[MultiWindowStrategyReport] = []
        versioned_optimized_defs: List[Dict[str, Any]] = []

        robust_count = 0
        inconsistent_count = 0
        insufficient_count = 0

        portfolio_cumulative_pnl = Decimal("0.00")
        total_trades_all_windows = 0
        total_wins_all_windows = 0

        for defn in strategy_definitions:
            s_id = str(defn.get("id"))
            s_name = str(defn.get("name"))
            cfg = defn.get("config", {})
            sym = str(cfg.get("symbol", "RELIANCE")).upper()
            base_price = float(cfg.get("buy_threshold", 1000.0))

            window_results: List[RollingWindowResult] = []
            all_oos_trades: List[BacktestTrade] = []
            cumulative_strat_pnl = Decimal("0.00")
            max_seen_drawdown = 0.0

            last_best_candidate: Optional[OptimizationCandidate] = None

            # Process each sequential rolling window
            for w_idx, win in enumerate(rolling_windows_data, 1):
                w_id = win.get("window_id", f"W_{w_idx:02d}")
                w_name = win.get("name", f"Window {w_idx}")
                is_candles = win["is_candles"]
                oos_candles = win["oos_candles"]

                # 1. In-Sample (IS) Optimization ONLY
                best_cand = None
                best_is_pnl = Decimal("-999999999.00")

                for cand in grid:
                    test_cfg = self.apply_candidate_to_strategy_config(cfg, cand, base_price)
                    test_def = [{"id": s_id, "name": s_name, "strategy_type": "RULE_BASED", "config": test_cfg}]

                    is_rep = self._backtest_service.run_multi_strategy_backtest(
                        strategy_definitions=test_def,
                        historical_candles_by_symbol=is_candles,
                        total_initial_capital=per_strat_capital,
                        same_bar_sl_tp_rule="SL_FIRST",
                        apply_transaction_costs=True,
                        apply_slippage=True,
                        auto_size_to_bucket=True,
                        risk_settings=risk_settings,
                    )
                    is_sum = is_rep.strategy_summaries[0]
                    if is_sum.net_realized_pnl > best_is_pnl:
                        best_is_pnl = is_sum.net_realized_pnl
                        best_cand = cand

                last_best_candidate = best_cand

                # 2. Out-of-Sample (OOS) Validation of the selected candidate
                opt_cfg = self.apply_candidate_to_strategy_config(cfg, best_cand, base_price) if best_cand else cfg
                oos_test_def = [{"id": s_id, "name": f"{s_name} [Opt]", "strategy_type": "RULE_BASED", "config": opt_cfg}]

                oos_rep = self._backtest_service.run_multi_strategy_backtest(
                    strategy_definitions=oos_test_def,
                    historical_candles_by_symbol=oos_candles,
                    total_initial_capital=per_strat_capital,
                    same_bar_sl_tp_rule="SL_FIRST",
                    apply_transaction_costs=True,
                    apply_slippage=True,
                    auto_size_to_bucket=True,
                    risk_settings=risk_settings,
                )
                oos_sum = oos_rep.strategy_summaries[0]

                # Evaluate single-window pass/fail criteria
                win_reasons = []
                if oos_sum.net_realized_pnl <= Decimal("0.00"):
                    win_reasons.append(f"OOS Net P&L <= 0 (Rs {oos_sum.net_realized_pnl:+,.2f})")
                if oos_sum.win_rate_pct < 40.0 and len(oos_sum.trades) > 0:
                    win_reasons.append(f"OOS Win Rate < 40% ({oos_sum.win_rate_pct:.1f}%)")
                if oos_sum.profit_factor < 1.10 and len(oos_sum.trades) > 0:
                    win_reasons.append(f"OOS Profit Factor < 1.10 ({oos_sum.profit_factor:.2f})")
                if oos_sum.max_drawdown_pct > 15.0:
                    win_reasons.append(f"OOS Max Drawdown > 15% ({oos_sum.max_drawdown_pct:.1f}%)")

                window_passed = len(win_reasons) == 0

                window_results.append(RollingWindowResult(
                    window_id=w_id,
                    window_name=w_name,
                    is_pnl=best_is_pnl,
                    oos_pnl=oos_sum.net_realized_pnl,
                    oos_trades=len(oos_sum.trades),
                    oos_wins=oos_sum.winning_trades,
                    oos_losses=oos_sum.losing_trades,
                    oos_win_rate_pct=oos_sum.win_rate_pct,
                    oos_profit_factor=oos_sum.profit_factor,
                    oos_max_drawdown_pct=oos_sum.max_drawdown_pct,
                    passed=window_passed,
                    fail_reasons=win_reasons,
                ))

                all_oos_trades.extend(oos_sum.trades)
                cumulative_strat_pnl += oos_sum.net_realized_pnl
                if oos_sum.max_drawdown_pct > max_seen_drawdown:
                    max_seen_drawdown = oos_sum.max_drawdown_pct

            # Aggregate multi-window metrics for this strategy
            total_strat_trades = len(all_oos_trades)
            total_strat_wins = len([t for t in all_oos_trades if t.net_pnl > Decimal("0.00")])
            total_strat_losses = len([t for t in all_oos_trades if t.net_pnl < Decimal("0.00")])
            strat_win_rate = (total_strat_wins / total_strat_trades * 100.0) if total_strat_trades > 0 else 0.0

            gross_profit = sum((t.gross_pnl for t in all_oos_trades if t.gross_pnl > Decimal("0.00")), Decimal("0.00"))
            gross_loss = abs(sum((t.gross_pnl for t in all_oos_trades if t.gross_pnl < Decimal("0.00")), Decimal("0.00")))
            strat_pf = float(gross_profit / gross_loss) if gross_loss > Decimal("0.00") else (99.0 if gross_profit > Decimal("0.00") else 0.0)
            avg_trade_pnl = (cumulative_strat_pnl / Decimal(str(total_strat_trades))) if total_strat_trades > 0 else Decimal("0.00")

            windows_passed = sum(1 for w in window_results if w.passed)
            total_windows = len(window_results)
            pass_ratio = (windows_passed / total_windows) if total_windows > 0 else 0.0

            # Multi-Window Robustness Classification
            rejection_reasons = []
            if total_strat_trades < min_total_oos_trades:
                status = "INSUFFICIENT_SAMPLE_SIZE"
                rejection_reasons.append(f"Total OOS sample size ({total_strat_trades}) < required min ({min_total_oos_trades})")
                insufficient_count += 1
            elif cumulative_strat_pnl <= Decimal("0.00"):
                status = "REJECTED_NEGATIVE_PNL"
                rejection_reasons.append(f"Cumulative OOS Net P&L non-positive (Rs {cumulative_strat_pnl:+,.2f})")
                inconsistent_count += 1
            elif pass_ratio < min_window_pass_ratio:
                status = "REJECTED_INCONSISTENT"
                rejection_reasons.append(f"Passed only {windows_passed}/{total_windows} windows ({pass_ratio*100:.1f}% < required {min_window_pass_ratio*100:.0f}%)")
                inconsistent_count += 1
            else:
                status = "ROBUST_WINNER"
                robust_count += 1

            opt_config = self.apply_candidate_to_strategy_config(cfg, last_best_candidate, base_price) if last_best_candidate else copy.deepcopy(cfg)
            versioned_optimized_defs.append({
                "id": f"{s_id}_WFA_OPT",
                "name": f"{s_name} (WFA Optimized)",
                "strategy_type": "RULE_BASED",
                "config": opt_config,
            })

            strategy_reports.append(MultiWindowStrategyReport(
                strategy_id=s_id,
                strategy_name=s_name,
                symbol=sym,
                total_oos_trades=total_strat_trades,
                total_oos_wins=total_strat_wins,
                total_oos_losses=total_strat_losses,
                overall_win_rate_pct=round(strat_win_rate, 1),
                total_gross_profit=gross_profit.quantize(PRECISION_TWO),
                total_gross_loss=gross_loss.quantize(PRECISION_TWO),
                overall_profit_factor=round(strat_pf, 2),
                cumulative_net_pnl=cumulative_strat_pnl.quantize(PRECISION_TWO),
                overall_max_drawdown_pct=round(max_seen_drawdown, 2),
                avg_trade_net_pnl=avg_trade_pnl.quantize(PRECISION_TWO),
                windows_passed=windows_passed,
                windows_total=total_windows,
                consistency_score_pct=round(pass_ratio * 100.0, 1),
                robustness_status=status,
                rejection_reasons=rejection_reasons,
                window_details=window_results,
                best_candidate=last_best_candidate,
                versioned_optimized_config=opt_config,
            ))

            portfolio_cumulative_pnl += cumulative_strat_pnl
            total_trades_all_windows += total_strat_trades
            total_wins_all_windows += total_strat_wins

        final_portfolio_nav = total_initial_capital + portfolio_cumulative_pnl
        portfolio_return = float(portfolio_cumulative_pnl / total_initial_capital) * 100.0 if total_initial_capital > 0 else 0.0
        overall_portfolio_win_rate = (total_wins_all_windows / total_trades_all_windows * 100.0) if total_trades_all_windows > 0 else 0.0

        # Sort strategy reports by cumulative Net P&L descending
        strategy_reports.sort(key=lambda r: r.cumulative_net_pnl, reverse=True)

        return MultiWindowConsolidatedReport(
            total_strategies=num_strategies,
            robust_strategies_count=robust_count,
            inconsistent_strategies_count=inconsistent_count,
            insufficient_sample_count=insufficient_count,
            total_portfolio_initial_capital=total_initial_capital,
            final_portfolio_nav=final_portfolio_nav.quantize(PRECISION_TWO),
            cumulative_net_pnl=portfolio_cumulative_pnl.quantize(PRECISION_TWO),
            overall_return_pct=round(portfolio_return, 2),
            total_oos_trades_all=total_trades_all_windows,
            overall_portfolio_win_rate_pct=round(overall_portfolio_win_rate, 2),
            strategy_reports=strategy_reports,
            versioned_optimized_strategies=versioned_optimized_defs,
        )
