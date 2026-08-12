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
  price: string;
  signal_fingerprint: string;
  status: string;
  created_at: string;
}

export class StrategyApi extends BaseApi {
  // --- Definitions ---
  async listDefinitions(): Promise<StrategyDefinition[]> {
    return this.handleRequest<StrategyDefinition[]>(
      this.http.get('/strategies'),
      true
    );
  }

  async createDefinition(data: Omit<StrategyDefinition, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<StrategyDefinition> {
    return this.handleRequest<StrategyDefinition>(
      this.http.post('/strategies', data),
      true
    );
  }

  async getDefinition(id: string): Promise<StrategyDefinition> {
    return this.handleRequest<StrategyDefinition>(
      this.http.get(`/strategies/${id}`),
      true
    );
  }

  async updateDefinition(id: string, data: Partial<Omit<StrategyDefinition, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<StrategyDefinition> {
    return this.handleRequest<StrategyDefinition>(
      this.http.put(`/strategies/${id}`, data),
      true
    );
  }

  async deleteDefinition(id: string): Promise<void> {
    return this.handleRequest<void>(
      this.http.delete(`/strategies/${id}`),
      true
    );
  }

  // --- Instances ---
  async listInstances(defId: string): Promise<StrategyInstance[]> {
    return this.handleRequest<StrategyInstance[]>(
      this.http.get(`/strategies/${defId}/instances`),
      true
    );
  }

  async createInstance(defId: string, data: { broker_id: string; execution_mode?: 'PAPER' | 'LIVE' }): Promise<StrategyInstance> {
    return this.handleRequest<StrategyInstance>(
      this.http.post(`/strategies/${defId}/instances`, data),
      true
    );
  }

  async startInstance(defId: string, instId: string): Promise<StrategyInstance> {
    return this.handleRequest<StrategyInstance>(
      this.http.post(`/strategies/${defId}/instances/${instId}/start`, {}),
      true
    );
  }

  async stopInstance(defId: string, instId: string): Promise<StrategyInstance> {
    return this.handleRequest<StrategyInstance>(
      this.http.post(`/strategies/${defId}/instances/${instId}/stop`, {}),
      true
    );
  }

  async pauseInstance(defId: string, instId: string): Promise<StrategyInstance> {
    return this.handleRequest<StrategyInstance>(
      this.http.post(`/strategies/${defId}/instances/${instId}/pause`, {}),
      true
    );
  }

  async resumeInstance(defId: string, instId: string): Promise<StrategyInstance> {
    return this.handleRequest<StrategyInstance>(
      this.http.post(`/strategies/${defId}/instances/${instId}/resume`, {}),
      true
    );
  }

  // --- Signals ---
  async getSignalHistory(defId: string, instId: string): Promise<Signal[]> {
    return this.handleRequest<Signal[]>(
      this.http.get(`/strategies/${defId}/instances/${instId}/signals`),
      true
    );
  }
}

export const strategyApi = new StrategyApi();
