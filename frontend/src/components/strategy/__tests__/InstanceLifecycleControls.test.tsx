import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InstanceLifecycleControls } from '@/components/strategy/InstanceLifecycleControls';
import { strategyApi, StrategyInstance } from '@/services/api/strategyApi';

vi.mock('@/services/api/strategyApi');

const mockInstance: StrategyInstance = {
  id: 'inst-1',
  strategy_definition_id: 'def-1',
  user_id: 'user-1',
  broker_id: 'broker-1',
  execution_mode: 'PAPER',
  status: 'DRAFT',
  started_at: null,
  stopped_at: null,
  last_execution_at: null,
  error_message: null,
  created_at: '2026-08-13T00:00:00Z',
  updated_at: '2026-08-13T00:00:00Z',
};

describe('InstanceLifecycleControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders paper trading mode indicator', () => {
    render(
      <InstanceLifecycleControls
        instance={mockInstance}
        definitionId="def-1"
      />
    );

    expect(screen.getByText(/paper trading mode/i)).toBeInTheDocument();
  });

  it('shows Start button for DRAFT status', () => {
    render(
      <InstanceLifecycleControls
        instance={mockInstance}
        definitionId="def-1"
      />
    );

    expect(screen.getByText(/start/i)).toBeInTheDocument();
  });

  it('shows Pause button for RUNNING status', () => {
    const runningInstance = { ...mockInstance, status: 'RUNNING' as const };

    render(
      <InstanceLifecycleControls
        instance={runningInstance}
        definitionId="def-1"
      />
    );

    expect(screen.getByText(/pause/i)).toBeInTheDocument();
  });

  it('shows Resume button for PAUSED status', () => {
    const pausedInstance = { ...mockInstance, status: 'PAUSED' as const };

    render(
      <InstanceLifecycleControls
        instance={pausedInstance}
        definitionId="def-1"
      />
    );

    expect(screen.getByText(/resume/i)).toBeInTheDocument();
  });

  it('shows LIVE warning for LIVE mode', () => {
    const liveInstance = { ...mockInstance, execution_mode: 'LIVE' as const };

    render(
      <InstanceLifecycleControls
        instance={liveInstance}
        definitionId="def-1"
      />
    );

    expect(screen.getByText(/live mode/i)).toBeInTheDocument();
  });

  it('calls start action on button click', async () => {
    const mockOnStateChange = vi.fn();
    vi.mocked(strategyApi.startInstance).mockResolvedValue({
      ...mockInstance,
      status: 'RUNNING',
    });

    render(
      <InstanceLifecycleControls
        instance={mockInstance}
        definitionId="def-1"
        onStateChange={mockOnStateChange}
      />
    );

    fireEvent.click(screen.getByText(/start/i));

    await waitFor(() => {
      expect(strategyApi.startInstance).toHaveBeenCalledWith('def-1', 'inst-1');
    });
  });

  it('requires confirmation for LIVE start', async () => {
    const liveInstance = { ...mockInstance, execution_mode: 'LIVE' as const };

    render(
      <InstanceLifecycleControls
        instance={liveInstance}
        definitionId="def-1"
      />
    );

    fireEvent.click(screen.getByText(/start/i));

    await waitFor(() => {
      expect(screen.getByText(/live mode.*execution/i)).toBeInTheDocument();
    });
  });

  it('handles API errors', async () => {
    const mockOnError = vi.fn();
    vi.mocked(strategyApi.startInstance).mockRejectedValue(
      new Error('Start failed')
    );

    render(
      <InstanceLifecycleControls
        instance={mockInstance}
        definitionId="def-1"
        onError={mockOnError}
      />
    );

    fireEvent.click(screen.getByText(/start/i));

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(expect.stringContaining('failed'));
    });
  });
});
