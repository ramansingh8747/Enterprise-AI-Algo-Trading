import { BaseApi } from './BaseApi';

export interface RiskSettingsResponse {
  max_order_quantity: string;
  max_order_notional: string;
  max_position_quantity: string;
  max_exposure_notional: string;
  max_orders_per_minute: number;
  daily_loss_limit: string;
  max_drawdown_percent: string;
  kill_switch_active: boolean;
  updated_at: string;
}

export interface RiskSettingsUpdate {
  max_order_quantity: number;
  max_order_notional: number;
  max_position_quantity: number;
  max_exposure_notional: number;
  max_orders_per_minute: number;
  daily_loss_limit: number;
  max_drawdown_percent: number;
}

export interface KillSwitchStatusResponse {
  kill_switch_active: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  updated_at?: string;
  user_id?: string;
  message?: string;
}

export interface LiveRiskMetricsResponse {
  current_exposure_notional: number;
  max_exposure_notional: number;
  exposure_utilization_pct: number;
  current_daily_pnl: number;
  current_daily_loss: number;
  daily_loss_limit: number;
  daily_loss_utilization_pct: number;
  current_orders_last_min: number;
  max_orders_per_minute: number;
  order_velocity_pct: number;
  kill_switch_active: boolean;
  active_positions_count: number;
  risk_status: 'SAFE' | 'WARNING' | 'BREACH';
  timestamp: string;
}

export class RiskApi extends BaseApi {
  public async getSettings(): Promise<RiskSettingsResponse> {
    return this.handleRequest<RiskSettingsResponse>(
      this.http.get('/admin/risk/settings'),
      false,
    );
  }

  public async getLiveMetrics(): Promise<LiveRiskMetricsResponse> {
    return this.handleRequest<LiveRiskMetricsResponse>(
      this.http.get('/admin/risk/live-metrics'),
      false,
    );
  }

  public async updateSettings(payload: RiskSettingsUpdate): Promise<RiskSettingsResponse> {
    return this.handleRequest<RiskSettingsResponse>(
      this.http.put('/admin/risk/settings', payload),
      false,
    );
  }

  public async getKillSwitchStatus(): Promise<KillSwitchStatusResponse> {
    return this.handleRequest<KillSwitchStatusResponse>(
      this.http.get('/admin/risk/kill-switch'),
      false,
    );
  }

  public async activateKillSwitch(): Promise<KillSwitchStatusResponse> {
    return this.handleRequest<KillSwitchStatusResponse>(
      this.http.post('/admin/risk/kill-switch/activate'),
      false,
    );
  }

  public async deactivateKillSwitch(): Promise<KillSwitchStatusResponse> {
    return this.handleRequest<KillSwitchStatusResponse>(
      this.http.post('/admin/risk/kill-switch/deactivate'),
      false,
    );
  }
}

export const riskApi = new RiskApi();
