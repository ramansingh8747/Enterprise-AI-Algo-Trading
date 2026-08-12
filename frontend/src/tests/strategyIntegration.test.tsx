import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import StrategyPage from '../pages/strategy/StrategyPage';
import { strategyApi } from '../services/api/strategyApi';

// Mock strategyApi
vi.mock('../services/api/strategyApi', () => ({
  strategyApi: {
    listDefinitions: vi.fn(),
  },
}));

describe('StrategyIntegration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', async () => {
    (strategyApi.listDefinitions as any).mockReturnValue(new Promise(() => {}));
    render(<StrategyPage />);
    expect(screen.getByText(/loading/i)).toBeDefined();
  });

  it('renders strategy list after successful API call', async () => {
    const mockStrategies = [
      {
        id: '1',
        user_id: 'u1',
        name: 'Test Strategy',
        strategy_type: 'MOMENTUM',
        config_json: '{}',
        is_active: true,
        created_at: '2026-08-11T09:00:00Z',
        updated_at: '2026-08-11T09:00:00Z',
      },
    ];
    (strategyApi.listDefinitions as any).mockResolvedValue(mockStrategies);
    
    render(<StrategyPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Strategy')).toBeDefined();
    });
  });
});
