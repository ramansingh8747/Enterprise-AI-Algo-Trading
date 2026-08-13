import { StrategyDefinition, StrategyInstance, Signal } from '../services/api/strategyApi';

export type { StrategyDefinition, StrategyInstance, Signal };

/**
 * Strategy lifecycle state enumeration.
 * Enforced by backend FSM.
 */
export type StrategyStatus = 'DRAFT' | 'READY' | 'RUNNING' | 'PAUSED' | 'STOPPED' | 'FAILED';

/**
 * Execution mode for strategy instances.
 */
export type ExecutionMode = 'PAPER' | 'LIVE';

/**
 * Request payload for creating a strategy definition.
 */
export interface StrategyDefinitionCreatePayload {
  name: string;
  strategy_type: string;
  config_json?: string;
}

/**
 * Request payload for updating a strategy definition.
 */
export interface StrategyDefinitionUpdatePayload {
  name?: string;
  strategy_type?: string;
  config_json?: string;
  is_active?: boolean;
}

/**
 * Request payload for creating a strategy instance.
 */
export interface StrategyInstanceCreatePayload {
  broker_id: string;
  execution_mode?: ExecutionMode;
}
