import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AdminDashboardPage from '@/pages/admin/AdminDashboardPage';
import { adminOverviewApi } from '@/services/api/adminOverviewApi';
import { adminSystemHealthApi } from '@/services/api/adminSystemHealthApi';

vi.mock('@/services/api/adminOverviewApi', () => ({
  adminOverviewApi: { get: vi.fn() },
}));

vi.mock('@/services/api/adminSystemHealthApi', () => ({
  adminSystemHealthApi: { get: vi.fn() },
}));

vi.mock('@/context/WebSocketProvider', () => ({
  useWebSocketContext: () => ({
    state: 'CONNECTED',
    connect: vi.fn(),
    disconnect: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  }),
}));

const overview = {
  generated_at: '2026-08-14T14:30:00Z',
  overall_status: 'UP' as const,
  live_trading_enabled: false,
  strategy_scheduler_enabled: false,
  metrics: {
    total_users: 10,
    active_users: 9,
    admin_users: 1,
    total_brokers: 3,
    active_brokers: 2,
    connected_brokers: 1,
    total_orders: 20,
    open_orders: 2,
    today_orders: 4,
    total_strategies: 5,
    running_strategies: 2,
    paper_portfolios: 4,
    open_paper_positions: 7,
    paper_realized_pnl: '1000',
    paper_unrealized_pnl: '250',
    kill_switch_active: false,
  },
};

const health = {
  checked_at: '2026-08-14T14:30:00Z',
  overall_status: 'UP' as const,
  live_trading_enabled: false,
  strategy_scheduler_enabled: false,
  components: [
    { name: 'API', status: 'UP' as const, message: 'FastAPI application is serving requests.', checked_at: '2026-08-14T14:30:00Z' },
    { name: 'Database', status: 'UP' as const, message: 'PostgreSQL connection is healthy.', checked_at: '2026-08-14T14:30:00Z' },
    { name: 'Redis', status: 'DISABLED' as const, message: 'Redis Event Bus is disabled by configuration.', checked_at: '2026-08-14T14:30:00Z' },
    { name: 'WebSocket', status: 'UP' as const, message: 'WebSocket service is available.', checked_at: '2026-08-14T14:30:00Z' },
  ],
  brokers: [
    { broker_id: 'broker-1', broker_name: 'Zerodha', broker_type: 'zerodha', status: 'UP' as const, message: 'An active broker session is present.', checked_at: '2026-08-14T14:30:00Z' },
  ],
};

describe('Step 34.174 — Admin Overview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (adminOverviewApi.get as any).mockResolvedValue(overview);
    (adminSystemHealthApi.get as any).mockResolvedValue(health);
  });

  it('renders backend-backed overview metrics and runtime status', async () => {
    render(<MemoryRouter><AdminDashboardPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText('SYSTEM HEALTHY')).toBeInTheDocument());
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('Zerodha')).toBeInTheDocument();
    expect(screen.getByText('LIVE TRADING')).toBeInTheDocument();
    expect(screen.getByText('OFF')).toBeInTheDocument();
  });

  it('refreshes both backend snapshots', async () => {
    render(<MemoryRouter><AdminDashboardPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('SYSTEM HEALTHY')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => {
      expect(adminOverviewApi.get).toHaveBeenCalledTimes(2);
      expect(adminSystemHealthApi.get).toHaveBeenCalledTimes(2);
    });
  });

  it('shows an error instead of fake overview values when backend fails', async () => {
    (adminOverviewApi.get as any).mockRejectedValueOnce(new Error('Permission denied'));

    render(<MemoryRouter><AdminDashboardPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Permission denied'));
    expect(screen.queryByText('SYSTEM HEALTHY')).not.toBeInTheDocument();
  });
});
