import { BaseApi } from './BaseApi';
import {
  PaperPortfolio,
  PaperPosition,
  PaperPortfolioSummary,
  PaperPortfolioCreatePayload,
} from '@/types/paperPortfolio';

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
   * Retrieves positions for a specified PAPER portfolio.
   */
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
  async getSummary(portfolioId: string): Promise<PaperPortfolioSummary> {
    return this.handleRequest<PaperPortfolioSummary>(
      this.http.get(`/paper-portfolios/${portfolioId}/summary`),
      false
    );
  }
}

export const paperPortfolioApi = new PaperPortfolioApi();
