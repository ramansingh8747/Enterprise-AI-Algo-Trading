import { BaseApi } from './BaseApi';

export type ReadinessStatus = 'PASS' | 'FAIL' | 'WARN';
export type ReadinessVerdict = 'LIVE_READY' | 'CONDITIONAL' | 'NOT_READY';

export interface ReadinessCheck {
  name: string;
  status: ReadinessStatus;
  message: string;
  details: Record<string, unknown>;
}

export type ActivationVerdict = 'ACTIVATION_AUTHORIZED' | 'ACTIVATION_BLOCKED';

export interface LiveActivationResponse {
  verdict: ActivationVerdict;
  broker_id: string;
  verified_at: string;
  confirmation_required: boolean;
  order_execution_attempted: boolean;
  live_trading_enabled: boolean;
  instructions: string[];
  blocking_reasons: string[];
}

export interface LiveReadinessResponse {
  verdict: ReadinessVerdict;
  broker_id: string;
  verified_at: string;
  order_execution_attempted: boolean;
  checks: ReadinessCheck[];
}

export class LiveReadinessApi extends BaseApi {
  async verify(brokerId: string, probeBroker = false): Promise<LiveReadinessResponse> {
    return this.handleRequest<LiveReadinessResponse>(
      this.http.get(`/admin/live-readiness/${brokerId}`, { params: { probe_broker: probeBroker } }),
      false,
    );
  }

  async authorizeActivation(brokerId: string, confirmed: boolean): Promise<LiveActivationResponse> {
    return this.handleRequest<LiveActivationResponse>(
      this.http.post(`/admin/live-activation/${brokerId}/authorize`, null, { params: { confirmed } }),
      false,
    );
  }
}

export const liveReadinessApi = new LiveReadinessApi();
