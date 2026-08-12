import { describe, it, expect, vi, beforeEach } from 'vitest';
import { paperPortfolioApi } from '@/services/api/paperPortfolioApi';
import axiosInstance from '@/services/http/axios';
import { ApiError } from '@/services/api/ApiError';

vi.mock('@/services/http/axios', () => {
  return {
    default: {
      get: vi.fn(),
      post: vi.fn(),
    },
  };
});

describe('PaperPortfolioApi Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. listPortfolios returns array of PaperPortfolio objects', async () => {
    const mockData = [
      {
        id: 'port-1',
        user_id: 'user-1',
        name: 'Default Paper Portfolio',
        execution_mode: 'PAPER',
        created_at: '2026-08-11T08:00:00Z',
        updated_at: '2026-08-11T08:00:00Z',
      },
    ];
    (axiosInstance.get as any).mockResolvedValueOnce({ data: mockData });

    const result = await paperPortfolioApi.listPortfolios();
    expect(axiosInstance.get).toHaveBeenCalledWith('/paper-portfolios');
    expect(result).toEqual(mockData);
  });

  it('2. createPortfolio posts payload and returns PaperPortfolio', async () => {
    const mockData = {
      id: 'port-2',
      user_id: 'user-1',
      name: 'Custom Paper Account',
      execution_mode: 'PAPER',
      created_at: '2026-08-11T08:00:00Z',
      updated_at: '2026-08-11T08:00:00Z',
    };
    (axiosInstance.post as any).mockResolvedValueOnce({ data: mockData });

    const result = await paperPortfolioApi.createPortfolio({ name: 'Custom Paper Account' });
    expect(axiosInstance.post).toHaveBeenCalledWith('/paper-portfolios', { name: 'Custom Paper Account' });
    expect(result).toEqual(mockData);
  });

  it('3. getPortfolio returns specific PaperPortfolio by ID', async () => {
    const mockData = {
      id: 'port-1',
      user_id: 'user-1',
      name: 'Default Paper Portfolio',
      execution_mode: 'PAPER',
      created_at: '2026-08-11T08:00:00Z',
      updated_at: '2026-08-11T08:00:00Z',
    };
    (axiosInstance.get as any).mockResolvedValueOnce({ data: mockData });

    const result = await paperPortfolioApi.getPortfolio('port-1');
    expect(axiosInstance.get).toHaveBeenCalledWith('/paper-portfolios/port-1');
    expect(result).toEqual(mockData);
  });

  it('4. getPositions returns array of PaperPosition objects', async () => {
    const mockPositions = [
      {
        id: 'pos-1',
        paper_portfolio_id: 'port-1',
        user_id: 'user-1',
        symbol: 'RELIANCE',
        quantity: '10.0000',
        average_price: '2500.0000',
        cost_basis: '25000.0000',
        realized_pnl: '100.0000',
        unrealized_pnl: '500.0000',
        created_at: '2026-08-11T08:00:00Z',
        updated_at: '2026-08-11T08:00:00Z',
      },
    ];
    (axiosInstance.get as any).mockResolvedValueOnce({ data: mockPositions });

    const result = await paperPortfolioApi.getPositions('port-1', false);
    expect(axiosInstance.get).toHaveBeenCalledWith('/paper-portfolios/port-1/positions', {
      params: { include_closed: false },
    });
    expect(result).toEqual(mockPositions);
  });

  it('5. getSummary returns PaperPortfolioSummary', async () => {
    const mockSummary = {
      paper_portfolio_id: 'port-1',
      user_id: 'user-1',
      execution_mode: 'PAPER',
      total_realized_pnl: '150.0000',
      total_unrealized_pnl: '350.0000',
      total_pnl: '500.0000',
      position_count: 1,
      updated_at: '2026-08-11T08:00:00Z',
    };
    (axiosInstance.get as any).mockResolvedValueOnce({ data: mockSummary });

    const result = await paperPortfolioApi.getSummary('port-1');
    expect(axiosInstance.get).toHaveBeenCalledWith('/paper-portfolios/port-1/summary');
    expect(result).toEqual(mockSummary);
  });

  it('6. handles 404 error correctly', async () => {
    const errorObj = {
      response: {
        status: 404,
        data: { detail: 'Paper portfolio not found.' },
      },
    };
    (axiosInstance.get as any).mockRejectedValueOnce(errorObj);

    await expect(paperPortfolioApi.getPortfolio('invalid-id')).rejects.toThrow(ApiError);
  });
});
