import { BaseApi } from './BaseApi';

export interface AdminPortfolioItem {
  portfolio_ref: string;
  source: 'PAPER_PORTFOLIO' | 'LIVE_ACCOUNT';
  execution_mode: 'PAPER' | 'LIVE' | string;
  user_id: string;
  user_name: string;
  user_role: string;
  broker_id?: string | null;
  broker_name?: string | null;
  strategy_instance_id?: string | null;
  strategy_name?: string | null;
  currency: string;
  initial_balance?: string | null;
  cash_balance?: string | null;
  invested_value: string;
  market_value: string;
  realized_pnl: string;
  unrealized_pnl: string;
  total_pnl: string;
  equity: string;
  position_count: number;
  valuation_at?: string | null;
  updated_at: string;
}

export interface AdminPortfolioSummary {
  total_accounts: number;
  paper_accounts: number;
  live_accounts: number;
  total_cash_balance: string;
  total_invested_value: string;
  total_market_value: string;
  realized_pnl: string;
  unrealized_pnl: string;
  total_pnl: string;
  total_equity: string;
}

export interface AdminPortfolioListResponse {
  items: AdminPortfolioItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  summary: AdminPortfolioSummary;
}

export interface AdminPortfolioFilters {
  page?: number;
  page_size?: number;
  search?: string;
  execution_mode?: string;
  user_id?: string;
  broker_id?: string;
  strategy_instance_id?: string;
}

class AdminPortfoliosApi extends BaseApi {
  async list(filters: AdminPortfolioFilters = {}): Promise<AdminPortfolioListResponse> {
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''));
    return this.handleRequest<AdminPortfolioListResponse>(this.http.get('/admin/portfolios', { params }), false);
  }

  async get(portfolioRef: string, source: AdminPortfolioItem['source']): Promise<AdminPortfolioItem> {
    return this.handleRequest<AdminPortfolioItem>(
      this.http.get(`/admin/portfolios/${encodeURIComponent(portfolioRef)}`, { params: { source } }), false,
    );
  }
}

export const adminPortfoliosApi = new AdminPortfoliosApi();
