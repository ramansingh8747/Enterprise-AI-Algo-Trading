import uuid
from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class FrozenStrategyConfigResponse(BaseModel):
    """Immutable metadata and parameters for a frozen strategy configuration."""
    version_id: str
    strategy_id: str
    strategy_name: str
    symbol: str
    status: str
    buy_threshold: float
    stop_loss: float
    target: float
    quantity: int
    side: str
    use_trend_filter: bool
    change_percent_threshold: float
    use_volatility_filter: bool
    max_adverse_volatility: float
    allocated_capital: Decimal
    position_sizing_rule: str
    execution_mode: str
    same_candle_ambiguity_rule: str
    slippage_model: str
    transaction_cost_model: str
    source_research_version: str
    optimization_windows_evaluated: int
    wfa_oos_trades_count: int
    wfa_oos_win_rate_pct: float
    wfa_oos_profit_factor: float
    wfa_oos_net_pnl: Decimal
    holdout_trades_count: int
    holdout_win_rate_pct: float
    holdout_profit_factor: float
    holdout_net_pnl: Decimal
    created_at_utc: str
    config_hash: str


class FrozenPaperPositionResponse(BaseModel):
    """Active open virtual position in a paper session."""
    symbol: str
    side: str  # "LONG"
    quantity: Decimal
    entry_price: Decimal
    current_price: Decimal
    unrealized_pnl: Decimal
    unrealized_return_pct: float
    entry_timestamp: str
    stop_loss_price: Decimal
    target_price: Decimal


class FrozenPaperTradeAuditResponse(BaseModel):
    """Detailed audit record of a completed virtual trade."""
    trade_id: str
    strategy_version: str
    symbol: str
    side: str
    entry_timestamp: str
    entry_price: Decimal
    exit_timestamp: str
    exit_price: Decimal
    quantity: Decimal
    gross_pnl: Decimal
    turnover: Decimal
    brokerage: Decimal
    stt_tax: Decimal
    exchange_charges: Decimal
    stamp_duty: Decimal
    gst: Decimal
    total_charges: Decimal
    net_pnl: Decimal
    return_pct: float
    exit_reason: str  # "TAKE_PROFIT", "STOP_LOSS", "MANUAL_CLOSE"


class PromotionReadinessStatus(str):
    INSUFFICIENT_SAMPLE = "INSUFFICIENT_SAMPLE"
    REJECTED = "REJECTED"
    PAPER_VALIDATED = "PAPER_VALIDATED"
    ROBUST_PAPER_CANDIDATE = "ROBUST_PAPER_CANDIDATE"


class FrozenPaperValidationScorecard(BaseModel):
    """Real-time assessment against N >= 50 trades robust quality gate and promotion readiness."""
    min_required_trades: int = 50
    completed_trades: int
    sample_size_satisfied: bool
    win_rate_pct: float
    win_rate_satisfied: bool  # >= 40%
    profit_factor: float
    profit_factor_satisfied: bool  # >= 1.10
    cumulative_net_pnl: Decimal
    net_pnl_positive: bool  # > 0
    max_drawdown_pct: float
    drawdown_acceptable: bool  # <= 15%
    tp_sl_invariant_violations: int = 0
    nav_accounting_discrepancy: Decimal = Decimal("0.0000")
    overall_status: str  # Backward-compatible status string
    promotion_readiness_status: str  # "INSUFFICIENT_SAMPLE", "REJECTED", "PAPER_VALIDATED", "ROBUST_PAPER_CANDIDATE"
    live_promotion_blocked: bool = True  # Strict safeguard: Live promotion is permanently blocked


class FrozenPaperSessionStateResponse(BaseModel):
    """Full operational snapshot of the active paper trading session."""
    session_id: str
    version_id: str
    status: str  # "ACTIVE", "PAUSED", "STOPPED"
    execution_mode: str = "PAPER"
    initial_capital: Decimal
    cash_balance: Decimal
    portfolio_nav: Decimal
    cumulative_realized_pnl: Decimal
    unrealized_pnl: Decimal
    total_charges_paid: Decimal
    total_trades_count: int
    winning_trades_count: int
    losing_trades_count: int
    win_rate_pct: float
    profit_factor: float
    max_drawdown_pct: float
    active_position: Optional[FrozenPaperPositionResponse] = None
    validation_scorecard: FrozenPaperValidationScorecard
    last_updated_at: str


class FrozenPaperStepRequest(BaseModel):
    """Single candle input for manual stepping."""
    timestamp: str
    open: float
    high: float
    low: float
    close: float
    change_percent: float


class FrozenPaperFeedSimulationRequest(BaseModel):
    """Parameters to simulate an independent market feed generating >= 30 trades."""
    candle_count: int = Field(default=80, ge=10, le=500)
    seed: int = Field(default=42, ge=1)
    base_volatility_pct: float = Field(default=1.2, ge=0.1, le=5.0)
    drift_pct: float = Field(default=0.1, ge=-2.0, le=2.0)
