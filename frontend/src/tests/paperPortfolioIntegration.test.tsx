import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PortfolioPage from '@/pages/portfolio/PortfolioPage';
import { paperPortfolioApi } from '@/services/api/paperPortfolioApi';

vi.mock('@/services/api/paperPortfolioApi', () => ({
  paperPortfolioApi: {
    listPortfolios: vi.fn(),
    createPortfolio: vi.fn(),
    getPortfolio: vi.fn(),
    getPositions: vi.fn(),
    getSummary: vi.fn(),
  },
}));

vi.mock('@/services/api/brokerDataApi', () => ({
  brokerDataApi: {
    getHoldings: vi.fn().mockResolvedValue([]),
    getPositions: vi.fn().mockResolvedValue([]),
  },
}));

const mockPortfolios = [
  {
    id: 'port-101',
    user_id: 'user-101',
    name: 'Main Paper Account',
    execution_mode: 'PAPER',
    created_at: '2026-08-11T08:00:00Z',
    updated_at: '2026-08-11T08:00:00Z',
  },
];

const mockPositions = [
  {
    id: 'pos-101',
    paper_portfolio_id: 'port-101',
    user_id: 'user-101',
    symbol: 'TCS',
    quantity: '10.0000',
    average_price: '3200.0000',
    cost_basis: '32000.0000',
    realized_pnl: '150.0000',
    unrealized_pnl: '450.0000',
    created_at: '2026-08-11T08:00:00Z',
    updated_at: '2026-08-11T08:00:00Z',
  },
];

const mockSummary = {
  paper_portfolio_id: 'port-101',
  user_id: 'user-101',
  execution_mode: 'PAPER',
  total_realized_pnl: '150.0000',
  total_unrealized_pnl: '450.0000',
  total_pnl: '600.0000',
  position_count: 1,
  updated_at: '2026-08-11T08:00:00Z',
};

describe('Phase 25 — Frontend Paper Portfolio UI Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Loads and renders server-managed paper portfolio list, positions, and summary metrics', async () => {
    (paperPortfolioApi.listPortfolios as any).mockResolvedValue(mockPortfolios);
    (paperPortfolioApi.getPositions as any).mockResolvedValue(mockPositions);
    (paperPortfolioApi.getSummary as any).mockResolvedValue(mockSummary);

    render(
      <MemoryRouter>
        <PortfolioPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/PAPER PORTFOLIO — SERVER BACKED/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getAllByText('TCS')[0]).toBeInTheDocument();
    });

    // Check summary P&L values
    expect(screen.getByText('Total Realized P&L')).toBeInTheDocument();
    expect(screen.getByText('Total Unrealized P&L')).toBeInTheDocument();
    expect(screen.getAllByText('Total P&L')[0]).toBeInTheDocument();
  });

  it('2. Handles error loading portfolios gracefully and provides retry button', async () => {
    (paperPortfolioApi.listPortfolios as any).mockRejectedValueOnce(new Error('Network connection failed'));

    render(
      <MemoryRouter>
        <PortfolioPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Network connection failed/i)).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    expect(retryBtn).toBeInTheDocument();
  });

  it('3. Ensures zero credential exposure in DOM', async () => {
    (paperPortfolioApi.listPortfolios as any).mockResolvedValue(mockPortfolios);
    (paperPortfolioApi.getPositions as any).mockResolvedValue(mockPositions);
    (paperPortfolioApi.getSummary as any).mockResolvedValue(mockSummary);

    const { container } = render(
      <MemoryRouter>
        <PortfolioPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/PAPER PORTFOLIO — SERVER BACKED/i)).toBeInTheDocument();
    });

    const html = container.innerHTML.toLowerCase();
    expect(html).not.toContain('api_key');
    expect(html).not.toContain('api_secret');
    expect(html).not.toContain('access_token');
  });
});
