import { BaseApi } from './BaseApi';

export interface AuditEventItem {
  id: string;
  action: string;
  outcome: string;
  user_id?: string | null;
  broker_id?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  details: Record<string, unknown>;
  occurred_at: string;
  user_name?: string | null;
  username?: string | null;
  broker_name?: string | null;
}
export interface AuditEventPage { total: number; items: AuditEventItem[]; page: number; page_size: number; }
export interface AuditSummary { total: number; successes: number; blocked: number; failures: number; info: number; last_event_at?: string | null; }
export interface AuditFilters { page?: number; page_size?: number; action?: string; outcome?: string; search?: string; since_hours?: number; }

class AdminAuditApi extends BaseApi {
  async list(filters: AuditFilters = {}): Promise<AuditEventPage> {
    return this.handleRequest<AuditEventPage>(this.http.get('/admin/audit', { params: filters }), false);
  }
  async summary(sinceHours = 24): Promise<AuditSummary> {
    return this.handleRequest<AuditSummary>(this.http.get('/admin/audit/summary', { params: { since_hours: sinceHours } }), false);
  }
  async get(id: string): Promise<AuditEventItem> {
    return this.handleRequest<AuditEventItem>(this.http.get(`/admin/audit/${id}`), false);
  }
}
export const adminAuditApi = new AdminAuditApi();
