import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { StrategyCreateForm } from '@/components/strategy/StrategyCreateForm';
import { strategyApi } from '@/services/api/strategyApi';

vi.mock('@/services/api/strategyApi');

describe('StrategyCreateForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form fields', () => {
    render(
      <BrowserRouter>
        <StrategyCreateForm />
      </BrowserRouter>
    );

    expect(screen.getByLabelText(/strategy name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/strategy type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/configuration/i)).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    render(
      <BrowserRouter>
        <StrategyCreateForm />
      </BrowserRouter>
    );

    const submitButton = screen.getByText(/create strategy/i);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/strategy name is required/i)).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    const mockOnSuccess = vi.fn();
    const mockStrategy = {
      id: 'new-1',
      user_id: 'user-1',
      name: 'New Strategy',
      strategy_type: 'momentum',
      config_json: null,
      is_active: true,
      created_at: '2026-08-13T00:00:00Z',
      updated_at: '2026-08-13T00:00:00Z',
    };

    vi.mocked(strategyApi.createDefinition).mockResolvedValue(mockStrategy);

    render(
      <BrowserRouter>
        <StrategyCreateForm onSuccess={mockOnSuccess} />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByLabelText(/strategy name/i), {
      target: { value: 'New Strategy' },
    });

    fireEvent.click(screen.getByText(/create strategy/i));

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith('new-1');
    });
  });

  it('displays backend validation errors', async () => {
    const error = new Error('Invalid config');
    error.details = { config_json: 'Invalid JSON format' };
    vi.mocked(strategyApi.createDefinition).mockRejectedValue(error);

    render(
      <BrowserRouter>
        <StrategyCreateForm />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByLabelText(/strategy name/i), {
      target: { value: 'Test' },
    });

    fireEvent.click(screen.getByText(/create strategy/i));

    await waitFor(() => {
      expect(screen.getByText(/invalid config/i)).toBeInTheDocument();
    });
  });
});
