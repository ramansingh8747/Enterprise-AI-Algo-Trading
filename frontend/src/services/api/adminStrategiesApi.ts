import axiosInstance from '@/services/http/axios';
import { BaseApi } from './BaseApi';

export interface AdminStrategyItem {
  id: string;
  user_id: string;
  user_name: string;
  username: string;
  name: string;
  strategy_type: string;
  config_json: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  imported_file_name: string | null;
  imported_file_type: string | null;
  imported_file_id: string | null;
}

export interface AdminStrategyListResponse {
  items: AdminStrategyItem[];
  total: number;
}

export class AdminStrategiesApi extends BaseApi {
  async list(): Promise<AdminStrategyListResponse> {
    return this.handleRequest<AdminStrategyListResponse>(this.http.get('/admin/strategies'), false);
  }

  async get(id: string): Promise<AdminStrategyItem> {
    return this.handleRequest<AdminStrategyItem>(this.http.get(`/admin/strategies/${id}`), false);
  }

  async update(id: string, data: { name?: string; strategy_type?: string; config_json?: string; is_active?: boolean }): Promise<AdminStrategyItem> {
    return this.handleRequest<AdminStrategyItem>(this.http.put(`/admin/strategies/${id}`, data), false);
  }

  async delete(id: string): Promise<void> {
    return this.handleRequest<void>(this.http.delete(`/admin/strategies/${id}`), false);
  }

  async download(id: string): Promise<void> {
    const response = await axiosInstance.get(`/admin/strategies/${id}/download`, { responseType: 'blob' });
    const contentDisposition = response.headers['content-disposition'] as string | undefined;
    const match = contentDisposition?.match(/filename="?([^";]+)"?/i);
    const filename = match?.[1] || 'strategy-source-file';
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}

export const adminStrategiesApi = new AdminStrategiesApi();
