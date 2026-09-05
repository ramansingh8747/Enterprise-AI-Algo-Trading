import { BaseApi } from './BaseApi';
import {
  FrozenStrategyConfig,
  FrozenPaperSessionState,
  FrozenPaperTradeAudit,
  FrozenPaperStepPayload,
  FrozenPaperFeedSimulationPayload,
} from '@/types/frozenPaperTrading';

export class FrozenPaperTradingApi extends BaseApi {
  /**
   * List all registered frozen strategy configurations.
   */
  async listConfigs(): Promise<FrozenStrategyConfig[]> {
    return this.handleRequest<FrozenStrategyConfig[]>(
      this.http.get('/frozen-paper-trading/configs'),
      false
    );
  }

  /**
   * Get details for a specific frozen strategy version.
   */
  async getConfig(versionId: string): Promise<FrozenStrategyConfig> {
    return this.handleRequest<FrozenStrategyConfig>(
      this.http.get(`/frozen-paper-trading/configs/${versionId}`),
      false
    );
  }

  /**
   * Get active session state, NAV, positions, and >=30 trades scorecard.
   */
  async getSessionState(versionId: string = 'COALINDIA_WFA_FROZEN_v1'): Promise<FrozenPaperSessionState> {
    return this.handleRequest<FrozenPaperSessionState>(
      this.http.get(`/frozen-paper-trading/session/${versionId}`),
      false
    );
  }

  /**
   * Get fresh-trade audit log.
   */
  async getTradeAuditLog(versionId: string = 'COALINDIA_WFA_FROZEN_v1'): Promise<FrozenPaperTradeAudit[]> {
    return this.handleRequest<FrozenPaperTradeAudit[]>(
      this.http.get(`/frozen-paper-trading/trades/${versionId}`),
      false
    );
  }

  /**
   * Start or initialize session with capital allocation.
   */
  async startSession(versionId: string = 'COALINDIA_WFA_FROZEN_v1', initialCapital?: number): Promise<FrozenPaperSessionState> {
    return this.handleRequest<FrozenPaperSessionState>(
      this.http.post(`/frozen-paper-trading/session/${versionId}/start`, null, {
        params: initialCapital ? { initial_capital: initialCapital } : {},
      }),
      false
    );
  }

  /**
   * Step single candle.
   */
  async stepSession(versionId: string, candle: FrozenPaperStepPayload): Promise<FrozenPaperSessionState> {
    return this.handleRequest<FrozenPaperSessionState>(
      this.http.post(`/frozen-paper-trading/session/${versionId}/step`, candle),
      false
    );
  }

  /**
   * Simulate a stream of independent market candles to generate >= 30 validation trades.
   */
  async simulateFeed(
    versionId: string = 'COALINDIA_WFA_FROZEN_v1',
    payload: FrozenPaperFeedSimulationPayload = { candle_count: 80, seed: 42, base_volatility_pct: 1.2, drift_pct: 0.1 }
  ): Promise<FrozenPaperSessionState> {
    return this.handleRequest<FrozenPaperSessionState>(
      this.http.post(`/frozen-paper-trading/session/${versionId}/simulate-feed`, payload),
      false
    );
  }

  /**
   * Reset virtual paper session back to clean state.
   */
  async resetSession(versionId: string = 'COALINDIA_WFA_FROZEN_v1'): Promise<FrozenPaperSessionState> {
    return this.handleRequest<FrozenPaperSessionState>(
      this.http.post(`/frozen-paper-trading/session/${versionId}/reset`, {}),
      false
    );
  }
}

export const frozenPaperTradingApi = new FrozenPaperTradingApi();
