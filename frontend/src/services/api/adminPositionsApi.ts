import { BaseApi } from './BaseApi';

export type AdminPositionExecutionMode = 'PAPER' | 'LIVE';

export interface AdminPositionItem {
  position_ref: string;
  source: 'PAPER_POSITION' | 'LIVE_POSITION';
  user_id: string;
  user_name: string;
  user_role: string;
  broker_id?: string | null;
  broker_name?: string | null;
  strategy_instance_id?: string | null;
  strategy_name?: string | null;
  execution_mode: AdminPositionExecutionMode | string;
  symbol: string;
  quantity: string;
  average_price: string;
  last_price?: string | null;
  market_value: string;
  realized_pnl: string;
  unrealized_pnl: string;
  valuation_at?: string | null;
  updated_at: string;
}

export interface AdminPositionSummary {
  total_positions: number;
  paper_positions: number;
  live_positions: number;
  total_market_value: string;
  realized_pnl: string;
  unrealized_pnl: string;
}

export interface AdminPositionListResponse {
  items: AdminPositionItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  summary: AdminPositionSummary;
}

export interface AdminPositionFilters {
  page?: number;
  page_size?: number;
  search?: string;
  execution_mode?: string;
  user_id?: string;
  broker_id?: string;
  strategy_instance_id?: string;
}

class AdminPositionsApi extends BaseApi {
  async list(filters: AdminPositionFilters = {}): Promise<AdminPositionListResponse> {
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''));
    return this.handleRequest<AdminPositionListResponse>(this.http.get('/admin/positions', { params }), false);
  }

  async get(positionRef: string, source: AdminPositionItem['source']): Promise<AdminPositionItem> {
    return this.handleRequest<AdminPositionItem>(
      this.http.get(`/admin/positions/${encodeURIComponent(positionRef)}`, { params: { source } }),
      false,
    );
  }
}

export const adminPositionsApi = new AdminPositionsApi();
