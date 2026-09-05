import { BaseApi } from './BaseApi';

export type ReconciliationStatus = 'MATCHED' | 'MISMATCH' | 'UNAVAILABLE' | 'ERROR';

export interface ReconciliationMetric {
  status: ReconciliationStatus;
  internal_count: number;
  external_count: number;
  difference_count: number;
  details: Record<string, unknown>[];
}

export interface ReconciliationAccount {
  user_id: string;
  broker_id: string;
  broker_name: string;
  broker_type: string;
  session_status: 'ACTIVE' | 'EXPIRED' | 'MISSING';
  overall_status: ReconciliationStatus;
  checked_at: string;
  cash: ReconciliationMetric;
  positions: ReconciliationMetric;
  orders: ReconciliationMetric;
  error?: string | null;
}

export interface ReconciliationSummary {
  checked_at: string;
  overall_status: ReconciliationStatus;
  accounts_checked: number;
  matched_accounts: number;
  mismatched_accounts: number;
  unavailable_accounts: number;
  error_accounts: number;
  cash: ReconciliationMetric;
  positions: ReconciliationMetric;
  orders: ReconciliationMetric;
  accounts: ReconciliationAccount[];
}

class AdminReconciliationApi extends BaseApi {
  async reconcile(): Promise<ReconciliationSummary> {
    return this.handleRequest<ReconciliationSummary>(
      this.http.get('/admin/reconciliation'),
      false,
    );
  }
}

export const adminReconciliationApi = new AdminReconciliationApi();
