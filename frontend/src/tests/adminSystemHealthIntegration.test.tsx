import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AdminDashboardPage from '@/pages/admin/AdminDashboardPage';
import { adminSystemHealthApi } from '@/services/api/adminSystemHealthApi';
import { adminOverviewApi } from '@/services/api/adminOverviewApi';

vi.mock('@/services/api/adminOverviewApi', () => ({
  adminOverviewApi: { get: vi.fn() },
}));

vi.mock('@/services/api/adminSystemHealthApi', () => ({
  adminSystemHealthApi: {
    get: vi.fn(),
  },
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
  metrics: { total_users: 1, active_users: 1, admin_users: 1, total_brokers: 1, active_brokers: 1, connected_brokers: 1, total_orders: 0, open_orders: 0, today_orders: 0, total_strategies: 0, running_strategies: 0, paper_portfolios: 0, open_paper_positions: 0, paper_realized_pnl: '0', paper_unrealized_pnl: '0', kill_switch_active: false },
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
    { name: 'WebSocket', status: 'UP' as const, message: 'WebSocket service is available (1 active connection(s)).', checked_at: '2026-08-14T14:30:00Z' },
  ],
  brokers: [
    {
      broker_id: 'broker-1',
      broker_name: 'Zerodha',
      broker_type: 'zerodha',
      status: 'UP' as const,
      message: 'An active broker session is present.',
      checked_at: '2026-08-14T14:30:00Z',
    },
  ],
};

describe('Step 34.173 — Admin Control Center System Health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads real system health data and renders the control center', async () => {
    (adminSystemHealthApi.get as any).mockResolvedValue(health);
    (adminOverviewApi.get as any).mockResolvedValue(overview);

    render(
      <MemoryRouter>
        <AdminDashboardPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('SYSTEM HEALTHY')).toBeInTheDocument();
    });

    expect(screen.getByText('Zerodha')).toBeInTheDocument();
    expect(screen.getByText('Database')).toBeInTheDocument();
    expect(screen.getByText('OFF')).toBeInTheDocument();
    expect(adminSystemHealthApi.get).toHaveBeenCalledTimes(1);
    expect(adminOverviewApi.get).toHaveBeenCalledTimes(1);
  });

  it('refreshes health status from the backend', async () => {
    (adminSystemHealthApi.get as any).mockResolvedValue(health);
    (adminOverviewApi.get as any).mockResolvedValue(overview);

    render(
      <MemoryRouter>
        <AdminDashboardPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('SYSTEM HEALTHY')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => expect(adminSystemHealthApi.get).toHaveBeenCalledTimes(2));
  });

  it('shows backend errors without creating fake health values', async () => {
    (adminSystemHealthApi.get as any).mockRejectedValue(new Error('Permission denied'));
    (adminOverviewApi.get as any).mockResolvedValue(overview);

    render(
      <MemoryRouter>
        <AdminDashboardPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Permission denied'));
    expect(screen.queryByText('SYSTEM HEALTHY')).not.toBeInTheDocument();
  });
});
