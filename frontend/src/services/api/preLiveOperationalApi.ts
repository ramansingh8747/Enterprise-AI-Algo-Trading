import { BaseApi } from './BaseApi';

export type OperationalStatus = 'PASS' | 'FAIL' | 'WARN';
export type OperationalVerdict = 'READY_FOR_CONTROLLED_LIVE_ACTIVATION' | 'CONDITIONAL' | 'NOT_READY';

export interface OperationalCheck {
  name: string;
  status: OperationalStatus;
  message: string;
  mode: 'LIVE_READINESS' | 'SIMULATED_DRILL' | 'STATIC';
  details: Record<string, unknown>;
}

export interface PreLiveOperationalResponse {
  verdict: OperationalVerdict;
  broker_id: string;
  verified_at: string;
  order_execution_attempted: boolean;
  real_broker_order_attempted: boolean;
  checks: OperationalCheck[];
}

class PreLiveOperationalApi extends BaseApi {
  async verify(brokerId: string): Promise<PreLiveOperationalResponse> {
    return this.handleRequest<PreLiveOperationalResponse>(
      this.http.get(`/admin/pre-live-operational/${brokerId}`),
      false,
    );
  }
}

export const preLiveOperationalApi = new PreLiveOperationalApi();
