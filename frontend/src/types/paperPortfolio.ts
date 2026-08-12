/**
 * Authoritative Paper Portfolio TypeScript Interfaces.
 * Strictly matches docs/api/paper_portfolio_api_contract.md.
 * Financial fields (quantity, average_price, cost_basis, realized_pnl, unrealized_pnl, total_pnl)
 * are string-serialized to preserve Python Decimal financial precision.
 */

// Authoritative Backend REST API Contract Types
export interface PaperPortfolio {
  id: string;
  user_id: string;
  strategy_instance_id?: string | null;
  name: string;
  execution_mode: string;
  created_at: string;
  updated_at: string;
}

export interface PaperPosition {
  id: string;
  paper_portfolio_id: string;
  user_id: string;
  strategy_instance_id?: string | null;
  symbol: string;
  quantity: string;
  average_price: string;
  cost_basis: string;
  realized_pnl: string;
  unrealized_pnl: string;
  created_at: string;
  updated_at: string;
}

export interface PaperPortfolioSummary {
  paper_portfolio_id: string;
  user_id: string;
  execution_mode: string;
  total_realized_pnl: string;
  total_unrealized_pnl: string;
  total_pnl: string;
  position_count: number;
  updated_at: string;
}

export interface PaperPortfolioCreatePayload {
  name?: string;
  strategy_instance_id?: string | null;
}

// Frontend Dashboard Client UI Types
export interface PaperHolding {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  investedValue: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
}

export interface PaperAccountSummary {
  paperBalance: number;
  investedValue: number;
  totalInvested?: number;
  portfolioValue: number;
  totalAccountValue?: number;
  totalPnl: number;
  totalPnlPercent: number;
}
