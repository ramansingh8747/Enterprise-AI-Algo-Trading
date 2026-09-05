import { BaseApi } from './BaseApi';
import { LiveActivationResponse, LiveReadinessResponse } from './liveReadinessApi';
import { PreLiveOperationalResponse } from './preLiveOperationalApi';

export type LiveGateVerdict = 'READY_FOR_CONTROLLED_LIVE_ACTIVATION' | 'CONDITIONAL' | 'NOT_READY';
export type ExecutionState = 'DISABLED' | 'BLOCKED' | 'READY';

export interface AdminLiveGateResponse {
  broker_id: string;
  verified_at: string;
  overall_verdict: LiveGateVerdict;
  live_trading_enabled: boolean;
  strategy_scheduler_enabled: boolean;
  kill_switch_active: boolean;
  execution_state: ExecutionState;
  readiness: LiveReadinessResponse;
  operational: PreLiveOperationalResponse;
  activation: LiveActivationResponse | null;
  safety_message: string;
}

class AdminLiveGateApi extends BaseApi {
  async evaluate(brokerId: string, probeBroker = true): Promise<AdminLiveGateResponse> {
    return this.handleRequest<AdminLiveGateResponse>(
      this.http.get(`/admin/live-gate/${brokerId}`, { params: { probe_broker: probeBroker } }),
      false,
    );
  }

  async authorize(brokerId: string, confirmed: boolean): Promise<LiveActivationResponse> {
    return this.handleRequest<LiveActivationResponse>(
      this.http.post(`/admin/live-gate/${brokerId}/authorize`, null, { params: { confirmed } }),
      false,
    );
  }
}

export const adminLiveGateApi = new AdminLiveGateApi();
