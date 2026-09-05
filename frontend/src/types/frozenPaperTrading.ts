export interface FrozenStrategyConfig {
  version_id: string;
  strategy_id: string;
  strategy_name: string;
  symbol: string;
  status: string;
  buy_threshold: number;
  stop_loss: number;
  target: number;
  quantity: number;
  side: string;
  use_trend_filter: boolean;
  change_percent_threshold: number;
  use_volatility_filter: boolean;
  max_adverse_volatility: number;
  allocated_capital: string | number;
  position_sizing_rule: string;
  execution_mode: string;
  same_candle_ambiguity_rule: string;
  slippage_model: string;
  transaction_cost_model: string;
  source_research_version: string;
  optimization_windows_evaluated: number;
  wfa_oos_trades_count: number;
  wfa_oos_win_rate_pct: number;
  wfa_oos_profit_factor: number;
  wfa_oos_net_pnl: string | number;
  holdout_trades_count: number;
  holdout_win_rate_pct: number;
  holdout_profit_factor: number;
  holdout_net_pnl: string | number;
  created_at_utc: string;
  config_hash: string;
}

export interface FrozenPaperPosition {
  symbol: string;
  side: string;
  quantity: string | number;
  entry_price: string | number;
  current_price: string | number;
  unrealized_pnl: string | number;
  unrealized_return_pct: number;
  entry_timestamp: string;
  stop_loss_price: string | number;
  target_price: string | number;
}

export interface FrozenPaperTradeAudit {
  trade_id: string;
  strategy_version: string;
  symbol: string;
  side: string;
  entry_timestamp: string;
  entry_price: string | number;
  exit_timestamp: string;
  exit_price: string | number;
  quantity: string | number;
  gross_pnl: string | number;
  turnover: string | number;
  brokerage: string | number;
  stt_tax: string | number;
  exchange_charges: string | number;
  stamp_duty: string | number;
  gst: string | number;
  total_charges: string | number;
  net_pnl: string | number;
  return_pct: number;
  exit_reason: string;
}

export interface FrozenPaperValidationScorecard {
  min_required_trades: number;
  completed_trades: number;
  sample_size_satisfied: boolean;
  win_rate_pct: number;
  win_rate_satisfied: boolean;
  profit_factor: number;
  profit_factor_satisfied: boolean;
  cumulative_net_pnl: string | number;
  net_pnl_positive: boolean;
  max_drawdown_pct: number;
  drawdown_acceptable: boolean;
  tp_sl_invariant_violations?: number;
  nav_accounting_discrepancy?: string | number;
  overall_status: 'INSUFFICIENT_SAMPLE_SIZE' | 'ROBUST_WINNER' | 'REJECTED_UNDERPERFORMING' | string;
  promotion_readiness_status?: 'INSUFFICIENT_SAMPLE' | 'REJECTED' | 'PAPER_VALIDATED' | 'ROBUST_PAPER_CANDIDATE' | string;
  live_promotion_blocked?: boolean;
}

export interface FrozenPaperSessionState {
  session_id: string;
  version_id: string;
  status: string;
  execution_mode: string;
  initial_capital: string | number;
  cash_balance: string | number;
  portfolio_nav: string | number;
  cumulative_realized_pnl: string | number;
  unrealized_pnl: string | number;
  total_charges_paid: string | number;
  total_trades_count: number;
  winning_trades_count: number;
  losing_trades_count: number;
  win_rate_pct: number;
  profit_factor: number;
  max_drawdown_pct: number;
  active_position: FrozenPaperPosition | null;
  validation_scorecard: FrozenPaperValidationScorecard;
  last_updated_at: string;
}

export interface FrozenPaperStepPayload {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  change_percent: number;
}

export interface FrozenPaperFeedSimulationPayload {
  candle_count?: number;
  seed?: number;
  base_volatility_pct?: number;
  drift_pct?: number;
}
