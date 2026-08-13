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
    return this.handleRequest<StrategyDefinition[]>(this.http.get('/strategies'), true);
  }

  async createDefinition(data: StrategyDefinitionCreateRequest): Promise<StrategyDefinition> {
    return this.handleRequest<StrategyDefinition>(this.http.post('/strategies', data), true);
  }

  async getDefinition(id: string): Promise<StrategyDefinition> {
    return this.handleRequest<StrategyDefinition>(this.http.get(`/strategies/${id}`), true);
  }

  async updateDefinition(id: string, data: StrategyDefinitionUpdateRequest): Promise<StrategyDefinition> {
    return this.handleRequest<StrategyDefinition>(this.http.put(`/strategies/${id}`, data), true);
  }

  async deleteDefinition(id: string): Promise<void> {
    return this.handleRequest<void>(this.http.delete(`/strategies/${id}`), true);
  }

  async listInstances(definitionId: string): Promise<StrategyInstance[]> {
    return this.handleRequest<StrategyInstance[]>(
      this.http.get(`/strategies/${definitionId}/instances`),
      true
    );
  }

  async createInstance(
    definitionId: string,
    data: StrategyInstanceCreateRequest
  ): Promise<StrategyInstance> {
    return this.handleRequest<StrategyInstance>(
      this.http.post(`/strategies/${definitionId}/instances`, data),
      true
    );
  }

  async startInstance(definitionId: string, instanceId: string): Promise<StrategyInstance> {
    return this.handleRequest<StrategyInstance>(
      this.http.post(`/strategies/${definitionId}/instances/${instanceId}/start`, {}),
      true
    );
  }

  async stopInstance(definitionId: string, instanceId: string): Promise<StrategyInstance> {
    return this.handleRequest<StrategyInstance>(
      this.http.post(`/strategies/${definitionId}/instances/${instanceId}/stop`, {}),
      true
    );
  }

  async pauseInstance(definitionId: string, instanceId: string): Promise<StrategyInstance> {
    return this.handleRequest<StrategyInstance>(
      this.http.post(`/strategies/${definitionId}/instances/${instanceId}/pause`, {}),
      true
    );
  }

  async resumeInstance(definitionId: string, instanceId: string): Promise<StrategyInstance> {
    return this.handleRequest<StrategyInstance>(
      this.http.post(`/strategies/${definitionId}/instances/${instanceId}/resume`, {}),
      true
    );
  }

  async getSignalHistory(definitionId: string, instanceId: string): Promise<Signal[]> {
    return this.handleRequest<Signal[]>(
      this.http.get(`/strategies/${definitionId}/instances/${instanceId}/signals`),
      true
    );
  }
}

export const strategyApi = new StrategyApi();
