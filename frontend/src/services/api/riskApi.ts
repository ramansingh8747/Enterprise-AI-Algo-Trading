import { BaseApi } from './BaseApi';

export interface KillSwitchStatusResponse {
  kill_switch_active: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  updated_at?: string;
  user_id?: string;
  message?: string;
}

export class RiskApi extends BaseApi {
  /**
   * Retrieves current Emergency Kill Switch status.
   */
  public async getKillSwitchStatus(): Promise<KillSwitchStatusResponse> {
    return this.handleRequest<KillSwitchStatusResponse>(
      this.http.get('/api/v1/admin/risk/kill-switch'),
      false
    );
  }

  /**
   * Activates Emergency Kill Switch platform-wide.
   */
  public async activateKillSwitch(): Promise<KillSwitchStatusResponse> {
    return this.handleRequest<KillSwitchStatusResponse>(
      this.http.post('/api/v1/admin/risk/kill-switch/activate'),
      false
    );
  }

  /**
   * Deactivates Emergency Kill Switch platform-wide.
   */
  public async deactivateKillSwitch(): Promise<KillSwitchStatusResponse> {
    return this.handleRequest<KillSwitchStatusResponse>(
      this.http.post('/api/v1/admin/risk/kill-switch/deactivate'),
      false
    );
  }
}

export const riskApi = new RiskApi();
