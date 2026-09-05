import { BaseApi } from './BaseApi';

export interface StrategyDefinition {
  id: string;
  user_id: string;
  name: string;
  strategy_type: string;
  config_json: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StrategyInstance {
  id: string;
  strategy_definition_id: string;
  user_id: string;
  broker_id: string;
  execution_mode: 'PAPER' | 'LIVE';
  status: 'DRAFT' | 'READY' | 'RUNNING' | 'PAUSED' | 'STOPPED' | 'FAILED';
  started_at: string | null;
  stopped_at: string | null;
  last_execution_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Signal {
  id: string;
  strategy_instance_id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: string;
  order_type: string;
  price: string | null;
  signal_fingerprint: string;
  status: string;
  created_at: string;
}

export interface StrategyDefinitionCreateRequest {
  name: string;
  strategy_type?: string;
  config_json?: string;
}

export interface StrategyDefinitionUpdateRequest {
  name?: string;
  strategy_type?: string;
  config_json?: string;
  is_active?: boolean;
}

export interface StrategyInstanceCreateRequest {
  broker_id: string;
  execution_mode?: 'PAPER' | 'LIVE';
}

export class StrategyApi extends BaseApi {
  async listDefinitions(): Promise<StrategyDefinition[]> {
    return this.handleRequest<StrategyDefinition[]>(this.http.get('/strategies'), false);
  }

  async createDefinition(data: StrategyDefinitionCreateRequest): Promise<StrategyDefinition> {
    return this.handleRequest<StrategyDefinition>(this.http.post('/strategies', data), false);
  }

  async getDefinition(id: string): Promise<StrategyDefinition> {
    return this.handleRequest<StrategyDefinition>(this.http.get(`/strategies/${id}`), false);
  }

  async updateDefinition(id: string, data: StrategyDefinitionUpdateRequest): Promise<StrategyDefinition> {
    return this.handleRequest<StrategyDefinition>(this.http.put(`/strategies/${id}`, data), false);
  }

  async deleteDefinition(id: string): Promise<void> {
    return this.handleRequest<void>(this.http.delete(`/strategies/${id}`), false);
  }

  async listInstances(definitionId: string): Promise<StrategyInstance[]> {
    return this.handleRequest<StrategyInstance[]>(
      this.http.get(`/strategies/${definitionId}/instances`),
      false
    );
  }

  async createInstance(
    definitionId: string,
    data: StrategyInstanceCreateRequest
  ): Promise<StrategyInstance> {
    return this.handleRequest<StrategyInstance>(
      this.http.post(`/strategies/${definitionId}/instances`, data),
      false
    );
  }

  async startInstance(definitionId: string, instanceId: string): Promise<StrategyInstance> {
    return this.handleRequest<StrategyInstance>(
      this.http.post(`/strategies/${definitionId}/instances/${instanceId}/start`, {}),
      false
    );
  }

  async runPaperCycle(
    definitionId: string,
    instanceId: string
  ): Promise<{
    status: string;
    mode: 'PAPER';
    instance_id: string;
    signals_count: number;
    order_id: string | null;
    order_status: string | null;
  }> {
    return this.handleRequest(
      this.http.post(`/strategies/${definitionId}/instances/${instanceId}/run-paper`, {}),
      false
    );
  }

  async stopInstance(definitionId: string, instanceId: string): Promise<StrategyInstance> {
    return this.handleRequest<StrategyInstance>(
      this.http.post(`/strategies/${definitionId}/instances/${instanceId}/stop`, {}),
      false
    );
  }

  async pauseInstance(definitionId: string, instanceId: string): Promise<StrategyInstance> {
    return this.handleRequest<StrategyInstance>(
      this.http.post(`/strategies/${definitionId}/instances/${instanceId}/pause`, {}),
      false
    );
  }

  async resumeInstance(definitionId: string, instanceId: string): Promise<StrategyInstance> {
    return this.handleRequest<StrategyInstance>(
      this.http.post(`/strategies/${definitionId}/instances/${instanceId}/resume`, {}),
      false
    );
  }

  async getSignalHistory(definitionId: string, instanceId: string): Promise<Signal[]> {
    return this.handleRequest<Signal[]>(
      this.http.get(`/strategies/${definitionId}/instances/${instanceId}/signals`),
      false
    );
  }

  async listPendingSignals(): Promise<StrategySignalDetail[]> {
    return this.handleRequest<StrategySignalDetail[]>(
      this.http.get('/strategies/signals/pending'),
      false
    );
  }

  async approveSignal(
    signalId: string,
    data: SignalApprovalRequest
  ): Promise<SignalApprovalResponse> {
    return this.handleRequest<SignalApprovalResponse>(
      this.http.post(`/strategies/signals/${signalId}/approve`, data),
      false
    );
  }

  async ignoreSignal(signalId: string): Promise<SignalIgnoreResponse> {
    return this.handleRequest<SignalIgnoreResponse>(
      this.http.post(`/strategies/signals/${signalId}/ignore`, {}),
      false
    );
  }

  async getAllUserInstances(): Promise<StrategyInstance[]> {
    return this.handleRequest<StrategyInstance[]>(
      this.http.get('/strategies/instances/all'),
      false
    );
  }

  async deployAllPaper(): Promise<{ success: boolean; deployed_count: number; total_strategies: number; message: string }> {
    return this.handleRequest(
      this.http.post('/strategies/deploy-all-paper', {}),
      false
    );
  }

  async stopAllPaper(): Promise<{ success: boolean; stopped_count: number; message: string }> {
    return this.handleRequest(
      this.http.post('/strategies/stop-all-paper', {}),
      false
    );
  }

  async switchModeScalper15Min(): Promise<{ success: boolean; active_mode: string; scalper_count: number; paused_count: number; message: string }> {
    return this.handleRequest(
      this.http.post('/strategies/switch-mode/scalper-15min', {}),
      false
    );
  }

  async switchModeFullDay(): Promise<{ success: boolean; deployed_count: number; total_strategies: number; message: string }> {
    return this.handleRequest(
      this.http.post('/strategies/switch-mode/full-day', {}),
      false
    );
  }

  async togglePauseStrategy(strategyId: string): Promise<{ success: boolean; strategy_id: string; is_active: boolean; status: string; message: string }> {
    return this.handleRequest(
      this.http.post(`/strategies/${strategyId}/toggle-pause`, {}),
      false
    );
  }

  async bulkUpdateConfig(
    data: Record<string, any>
  ): Promise<{ success: boolean; updated_count: number; message: string; applied_settings?: Record<string, any> }> {
    return this.handleRequest(
      this.http.post('/strategies/bulk-update-config', data),
      false
    );
  }
}

export interface SignalApprovalRequest {
  actual_quantity: string;
  execution_mode?: 'PAPER' | 'LIVE';
  custom_stop_loss?: string;
  custom_target?: string;
}

export interface SignalApprovalResponse {
  signal_id: string;
  status: string;
  order_id: string;
  actual_quantity: string;
  execution_mode: string;
  actioned_at: string;
}

export interface SignalIgnoreResponse {
  signal_id: string;
  status: string;
  actioned_at: string;
}

export interface StrategySignalDetail extends Signal {
  suggested_quantity?: string | null;
  actual_quantity?: string | null;
  stop_loss?: string | null;
  target?: string | null;
  risk_reward?: string | null;
  reason?: string | null;
  indicators_json?: string | null;
  executed_order_id?: string | null;
  actioned_at?: string | null;
}

export const strategyApi = new StrategyApi();


export interface StrategyImportResponse {
  id: string;
  user_id: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  extracted_text: string | null;
  extracted_config: Record<string, unknown>;
  warnings: string[];
  status: 'PENDING' | 'CONFIRMED';
  strategy_definition_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface StrategyImportConfirmRequest {
  name: string;
  strategy_type?: string;
}

export interface StrategyImportConfirmResponse {
  import_id: string;
  strategy_definition_id: string;
  strategy_name: string;
  status: string;
}

export class StrategyImportApi extends BaseApi {
  async upload(file: File): Promise<StrategyImportResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.handleRequest<StrategyImportResponse>(
      this.http.post('/strategies/imports', formData),
      false
    );
  }

  async get(importId: string): Promise<StrategyImportResponse> {
    return this.handleRequest<StrategyImportResponse>(
      this.http.get(`/strategies/imports/${importId}`),
      false
    );
  }

  async download(importId: string): Promise<void> {
    const response = await this.http.get(`/strategies/imports/${importId}/download`, { responseType: 'blob' });
    const contentDisposition = response.headers['content-disposition'] as string | undefined;
    const match = contentDisposition?.match(/filename=\"?([^\";]+)\"?/i);
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

  async confirm(
    importId: string,
    payload: StrategyImportConfirmRequest
  ): Promise<StrategyImportConfirmResponse> {
    return this.handleRequest<StrategyImportConfirmResponse>(
      this.http.post(`/strategies/imports/${importId}/confirm`, payload),
      false
    );
  }
}

export const strategyImportApi = new StrategyImportApi();
