import { BaseApi } from './BaseApi';

export interface BrokerRequest {
  broker_name: string;
  broker_type: string;
  api_key: string;
  api_secret: string;
  client_id?: string;
  is_active?: boolean;
}

export interface BrokerResponse {
  id: string;
  broker_name: string;
  broker_type: string;
  client_id?: string | null;
  is_active: boolean;
}

export class BrokersApi extends BaseApi {
  async createBroker(data: BrokerRequest): Promise<BrokerResponse> {
    return this.handleRequest<BrokerResponse>(
      this.http.post('/brokers', data),
      true
    );
  }

  async listBrokers(): Promise<BrokerResponse[]> {
    return this.handleRequest<BrokerResponse[]>(
      this.http.get('/brokers'),
      true
    );
  }

  async getBroker(brokerId: string): Promise<BrokerResponse> {
    return this.handleRequest<BrokerResponse>(
      this.http.get(`/brokers/${brokerId}`),
      true
    );
  }

  async updateBroker(brokerId: string, data: Partial<BrokerRequest>): Promise<BrokerResponse> {
    return this.handleRequest<BrokerResponse>(
      this.http.put(`/brokers/${brokerId}`, data),
      true
    );
  }

  async deleteBroker(brokerId: string): Promise<void> {
    await this.handleRequest<void>(
      this.http.delete(`/brokers/${brokerId}`),
      false
    );
  }
}

export const brokersApi = new BrokersApi();
