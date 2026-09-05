export interface PortfolioValuation {
  execution_mode: 'LIVE' | 'PAPER';
  user_id: string;
  broker_id?: string | null;
  paper_portfolio_id?: string | null;
  cash_balance?: string | null;
  market_value: string;
  realized_pnl: string;
  unrealized_pnl: string;
  total_pnl: string;
  equity: string;
  position_count: number;
  valued_at: string;
}
