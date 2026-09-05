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
    runPaperCycle: vi.fn(),
  },
}));

describe('StrategyLifecycleIntegration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders instance list and handles start action', async () => {
    const mockInstances = [{ id: 'inst1', status: 'READY', execution_mode: 'PAPER' }];
    (strategyApi.listInstances as any).mockResolvedValue(mockInstances);
    (strategyApi.startInstance as any).mockResolvedValue({ ...mockInstances[0], status: 'RUNNING' });

    render(<StrategyInstanceList strategyDefinitionId="def1" />);

    await waitFor(() => expect(screen.getByText('READY')).toBeDefined());
    fireEvent.click(screen.getByText('Start'));

    await waitFor(() => {
      expect(strategyApi.startInstance).toHaveBeenCalledWith('def1', 'inst1');
    });
  });

  it('runs one PAPER cycle only for a running PAPER instance', async () => {
    const mockInstances = [{ id: 'inst-paper', status: 'RUNNING', execution_mode: 'PAPER' }];
    (strategyApi.listInstances as any).mockResolvedValue(mockInstances);
    (strategyApi.runPaperCycle as any).mockResolvedValue({
      status: 'COMPLETED',
      mode: 'PAPER',
      instance_id: 'inst-paper',
      signals_count: 1,
      order_id: 'PAPER-TEST-1',
      order_status: 'COMPLETE',
    });

    render(<StrategyInstanceList strategyDefinitionId="def1" />);

    await waitFor(() => expect(screen.getByText('Run PAPER Cycle')).toBeDefined());
    fireEvent.click(screen.getByText('Run PAPER Cycle'));

    await waitFor(() => {
      expect(strategyApi.runPaperCycle).toHaveBeenCalledWith('def1', 'inst-paper');
      expect(screen.getByText(/PAPER cycle completed: PAPER-TEST-1/)).toBeDefined();
    });
  });
});
