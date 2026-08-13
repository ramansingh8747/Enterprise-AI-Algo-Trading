import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import StrategyManagementPage from '@/pages/strategy/StrategyManagementPage';
import { strategyApi } from '@/services/api/strategyApi';

vi.mock('@/services/api/strategyApi');
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@example.com' },
    isAuthenticated: true,
  }),
}));

describe('StrategyManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(strategyApi.listDefinitions).mockImplementation(
      () => new Promise(() => {})
    );

    render(
      <BrowserRouter>
        <StrategyManagementPage />
      </BrowserRouter>
    );

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders strategy list when data loads', async () => {
    const mockStrategies = [
      {
        id: '1',
        user_id: 'user-1',
        name: 'Test Strategy',
        strategy_type: 'momentum',
        config_json: null,
        is_active: true,
        created_at: '2026-08-13T00:00:00Z',
        updated_at: '2026-08-13T00:00:00Z',
      },
    ];

    vi.mocked(strategyApi.listDefinitions).mockResolvedValue(mockStrategies);

    render(
      <BrowserRouter>
        <StrategyManagementPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Strategy')).toBeInTheDocument();
    });
  });

  it('renders empty state when no strategies exist', async () => {
    vi.mocked(strategyApi.listDefinitions).mockResolvedValue([]);

    render(
      <BrowserRouter>
        <StrategyManagementPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/no strategies yet/i)).toBeInTheDocument();
    });
  });

  it('shows error state on API failure', async () => {
    const error = new Error('API Error');
    vi.mocked(strategyApi.listDefinitions).mockRejectedValue(error);

    render(
      <BrowserRouter>
        <StrategyManagementPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/failed to load strategies/i)).toBeInTheDocument();
    });
  });

  it('displays create button', async () => {
    vi.mocked(strategyApi.listDefinitions).mockResolvedValue([]);

    render(
      <BrowserRouter>
        <StrategyManagementPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/create strategy/i)).toBeInTheDocument();
    });
  });
});
