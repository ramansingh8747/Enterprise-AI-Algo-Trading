import { BaseApi } from './BaseApi';

export interface AdminBrokerSessionSummary {
  active: boolean;
  session_count: number;
  active_session_count: number;
  earliest_expiry: string | null;
}

export interface AdminBrokerItem {
  id: string;
  broker_name: string;
  broker_type: string;
  client_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  session: AdminBrokerSessionSummary;
}

export interface AdminBrokerListResponse {
  items: AdminBrokerItem[];
  total: number;
}

class AdminBrokersApi extends BaseApi {
  async list(): Promise<AdminBrokerListResponse> {
    return this.handleRequest<AdminBrokerListResponse>(
      this.http.get('/admin/brokers'),
      false,
    );
  }
}

export const adminBrokersApi = new AdminBrokersApi();
