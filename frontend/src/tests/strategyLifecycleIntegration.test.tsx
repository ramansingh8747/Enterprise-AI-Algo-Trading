import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { StrategyInstanceList } from '../components/strategy/StrategyInstanceList';
import { strategyApi } from '../services/api/strategyApi';

vi.mock('../services/api/strategyApi', () => ({
  strategyApi: {
    listInstances: vi.fn(),
    startInstance: vi.fn(),
    pauseInstance: vi.fn(),
    stopInstance: vi.fn(),
    resumeInstance: vi.fn(),
  },
}));

describe('StrategyLifecycleIntegration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders instance list and handles start action', async () => {
    const mockInstances = [
      {
        id: 'inst1',
        status: 'READY',
        execution_mode: 'PAPER',
      },
    ];
    (strategyApi.listInstances as any).mockResolvedValue(mockInstances);
    (strategyApi.startInstance as any).mockResolvedValue({ ...mockInstances[0], status: 'RUNNING' });

    render(<StrategyInstanceList strategyDefinitionId="def1" />);
    
    await waitFor(() => {
      expect(screen.getByText('READY')).toBeDefined();
    });

    const startBtn = screen.getByText('Start');
    fireEvent.click(startBtn);

    await waitFor(() => {
        expect(strategyApi.startInstance).toHaveBeenCalledWith('def1', 'inst1');
    });
  });
});
