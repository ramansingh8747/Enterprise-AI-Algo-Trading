import { BaseApi } from './BaseApi';

export type HealthStatus = 'UP' | 'DOWN' | 'DISABLED' | 'UNKNOWN';
export type OverallHealthStatus = 'UP' | 'DEGRADED' | 'DOWN';

export interface SystemHealthComponent {
  name: string;
  status: HealthStatus;
  message: string;
  checked_at: string;
}

export interface BrokerHealthComponent {
  broker_id: string;
  broker_name: string;
  broker_type: string;
  status: HealthStatus;
  message: string;
  checked_at: string;
}

export interface AdminSystemHealthResponse {
  checked_at: string;
  overall_status: OverallHealthStatus;
  live_trading_enabled: boolean;
  strategy_scheduler_enabled: boolean;
  components: SystemHealthComponent[];
  brokers: BrokerHealthComponent[];
}

class AdminSystemHealthApi extends BaseApi {
  async get(): Promise<AdminSystemHealthResponse> {
    return this.handleRequest<AdminSystemHealthResponse>(
      this.http.get('/admin/system-health'),
      false,
    );
  }
}

export const adminSystemHealthApi = new AdminSystemHealthApi();
