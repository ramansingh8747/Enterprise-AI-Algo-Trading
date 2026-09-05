import { BaseApi } from './BaseApi';
import {
  PaperPortfolio,
  PaperPosition,
  PaperPortfolioSummary,
  PaperPortfolioCreatePayload,
} from '@/types/paperPortfolio';
import { PortfolioValuation } from '@/types/portfolioValuation';

export class PaperPortfolioApi extends BaseApi {
  /**
   * Retrieves all PAPER portfolios for the current authenticated user.
   */
  async listPortfolios(): Promise<PaperPortfolio[]> {
    return this.handleRequest<PaperPortfolio[]>(
      this.http.get('/paper-portfolios'),
      false
    );
  }

  /**
   * Initializes or creates a new PAPER portfolio.
   */
  async createPortfolio(payload?: PaperPortfolioCreatePayload): Promise<PaperPortfolio> {
    return this.handleRequest<PaperPortfolio>(
      this.http.post('/paper-portfolios', payload || {}),
      false
    );
  }

  /**
   * Retrieves details for a specific PAPER portfolio by ID.
   */
  async getPortfolio(portfolioId: string): Promise<PaperPortfolio> {
    return this.handleRequest<PaperPortfolio>(
      this.http.get(`/paper-portfolios/${portfolioId}`),
      false
    );
  }

  /**
   * Resets an owned PAPER portfolio and clears positions, optionally updating starting initial balance.
   */
  async resetPortfolio(portfolioId: string = 'ALL_CONSOLIDATED', initialBalance?: number): Promise<PaperPortfolio> {
    return this.handleRequest<PaperPortfolio>(
      this.http.post(`/paper-portfolios/${portfolioId}/reset`, {}, {
        params: initialBalance !== undefined ? { initial_balance: initialBalance } : {},
      }),
      false
    );
  }

  async getAllPositions(includeClosed: boolean = false): Promise<PaperPosition[]> {
    return this.handleRequest<PaperPosition[]>(
      this.http.get('/paper-portfolios/positions/user-all', {
        params: { include_closed: includeClosed },
      }),
      false
    );
  }

  async getAllSummary(): Promise<PaperPortfolioSummary> {
    return this.handleRequest<PaperPortfolioSummary>(
      this.http.get('/paper-portfolios/summary/user-all'),
      false
    );
  }

  async getPositions(portfolioId: string, includeClosed: boolean = false): Promise<PaperPosition[]> {
    return this.handleRequest<PaperPosition[]>(
      this.http.get(`/paper-portfolios/${portfolioId}/positions`, {
        params: { include_closed: includeClosed },
      }),
      false
    );
  }

  /**
   * Retrieves financial summary metrics (P&L totals) for a PAPER portfolio.
   */
  async getValuation(portfolioId: string, brokerId: string): Promise<PortfolioValuation> {
    return this.handleRequest<PortfolioValuation>(
      this.http.get(`/paper-portfolios/${portfolioId}/valuation`, { params: { broker_id: brokerId } }),
      false
    );
  }

  async getSummary(portfolioId: string): Promise<PaperPortfolioSummary> {
    return this.handleRequest<PaperPortfolioSummary>(
      this.http.get(`/paper-portfolios/${portfolioId}/summary`),
      false
    );
  }
}

export const paperPortfolioApi = new PaperPortfolioApi();
