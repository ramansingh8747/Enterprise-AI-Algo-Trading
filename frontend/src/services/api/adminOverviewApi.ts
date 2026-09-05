import { BaseApi } from './BaseApi';

export interface AdminOverviewMetrics {
  total_users: number;
  active_users: number;
  admin_users: number;
  total_brokers: number;
  active_brokers: number;
  connected_brokers: number;
  total_orders: number;
  open_orders: number;
  today_orders: number;
  total_strategies: number;
  running_strategies: number;
  paper_portfolios: number;
  open_paper_positions: number;
  paper_realized_pnl: string;
  paper_unrealized_pnl: string;
  kill_switch_active: boolean;
}

export interface AdminOverviewResponse {
  generated_at: string;
  overall_status: 'UP' | 'DEGRADED' | 'DOWN';
  metrics: AdminOverviewMetrics;
  live_trading_enabled: boolean;
  strategy_scheduler_enabled: boolean;
}

export class AdminOverviewApi extends BaseApi {
  async get(): Promise<AdminOverviewResponse> {
    return this.handleRequest<AdminOverviewResponse>(
      this.http.get('/admin/overview'),
      false,
    );
  }
}

export const adminOverviewApi = new AdminOverviewApi();
