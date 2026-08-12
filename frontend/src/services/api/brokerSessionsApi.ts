import { BaseApi } from './BaseApi';

export interface BrokerSessionRequest {
  broker_id: string;
  access_token: string;
  expires_at: string; // ISO 8601 datetime
}

export interface BrokerSessionResponse {
  id: string;
  broker_id: string;
  user_id: string;
  expires_at: string;
}

export class BrokerSessionsApi extends BaseApi {
  async createSession(data: BrokerSessionRequest): Promise<BrokerSessionResponse> {
    return this.handleRequest<BrokerSessionResponse>(
      this.http.post('/broker-sessions', data),
      false
    );
  }

  async getSession(brokerId: string): Promise<BrokerSessionResponse> {
    return this.handleRequest<BrokerSessionResponse>(
      this.http.get(`/broker-sessions/${brokerId}`),
      false
    );
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.handleRequest<void>(
      this.http.delete(`/broker-sessions/${sessionId}`),
      false
    );
  }
}

export const brokerSessionsApi = new BrokerSessionsApi();
