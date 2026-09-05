import { BaseApi } from './BaseApi';

export type AdminOrderExecutionMode = 'PAPER' | 'LIVE';

export interface AdminOrderItem {
  order_ref: string;
  source: 'BROKER_ORDER' | 'PAPER_EXECUTION';
  user_id: string;
  user_name: string;
  user_role: string;
  broker_id?: string | null;
  broker_name?: string | null;
  execution_mode: AdminOrderExecutionMode | string;
  symbol: string;
  side: 'BUY' | 'SELL' | string;
  quantity: string;
  filled_quantity: string;
  average_fill_price?: string | null;
  order_type?: string | null;
  product?: string | null;
  price?: string | null;
  trigger_price?: string | null;
  status: string;
  strategy_instance_id?: string | null;
  signal_id?: string | null;
  execution_id?: string | null;
  executed_at?: string | null;
  last_synced_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminOrderListResponse {
  items: AdminOrderItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface AdminOrderFilters {
  page?: number;
  page_size?: number;
  search?: string;
  execution_mode?: string;
  status?: string;
  side?: string;
}

class AdminOrdersApi extends BaseApi {
  async list(filters: AdminOrderFilters = {}): Promise<AdminOrderListResponse> {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== undefined && value !== '')
    );
    return this.handleRequest<AdminOrderListResponse>(
      this.http.get('/admin/orders', { params }),
      false,
    );
  }

  async get(orderRef: string): Promise<AdminOrderItem> {
    return this.handleRequest<AdminOrderItem>(
      this.http.get(`/admin/orders/${encodeURIComponent(orderRef)}`),
      false,
    );
  }
}

export const adminOrdersApi = new AdminOrdersApi();
