import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SignalActionModal } from '../components/dashboard/SignalActionModal';
import { strategyApi, StrategySignalDetail } from '../services/api/strategyApi';

describe('SignalActionModal Human-in-the-Loop', () => {
  const mockSignal: StrategySignalDetail = {
    id: 'sig-12345',
    strategy_instance_id: 'inst-999',
    symbol: 'TCS',
    side: 'BUY',
    quantity: '10',
    suggested_quantity: '10',
    actual_quantity: null,
    order_type: 'MARKET',
    price: '3500.00',
    stop_loss: '3430.00',
    target: '3640.00',
    risk_reward: '1:2',
    reason: 'Bullish Breakout on 5m EMA Cross',
    indicators_json: JSON.stringify({ RSI: 62.5, EMA_20: 3480.0 }),
    signal_fingerprint: 'fp-101',
    status: 'PROPOSED',
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all advisory strategy metrics without placing automated order', () => {
    render(
      <SignalActionModal
        isOpen={true}
        signal={mockSignal}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getAllByText(/BUY/i).length).toBeGreaterThan(0);
    expect(screen.getByText('TCS')).toBeDefined();
    expect(screen.getByText('10')).toBeDefined(); // Suggested qty
    expect(screen.getByText('₹3430.00')).toBeDefined(); // Suggested SL
    expect(screen.getByText('₹3640.00')).toBeDefined(); // Suggested Target
    expect(screen.getByText('1:2')).toBeDefined(); // Risk:Reward
    expect(screen.getByText('Bullish Breakout on 5m EMA Cross')).toBeDefined(); // Strategy Reason
    expect(screen.getByText('RSI:')).toBeDefined();
  });

  it('allows user to modify actual quantity and submit manual BUY approval', async () => {
    const approveSpy = vi.spyOn(strategyApi, 'approveSignal').mockResolvedValue({
      signal_id: 'sig-12345',
      status: 'APPROVED',
      order_id: 'ORD-PAPER-777',
      actual_quantity: '25',
      execution_mode: 'PAPER',
      actioned_at: new Date().toISOString(),
    });

    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <SignalActionModal
        isOpen={true}
        signal={mockSignal}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    // Find actual quantity input and change to 25
    const qtyInput = screen.getByLabelText('Actual Quantity');
    fireEvent.change(qtyInput, { target: { value: '25' } });

    // Click Confirm BUY button
    const confirmBtn = screen.getByText(/Confirm BUY/i);
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(approveSpy).toHaveBeenCalledWith('sig-12345', {
        actual_quantity: '25',
        execution_mode: 'PAPER',
        custom_stop_loss: '3430.00',
        custom_target: '3640.00',
      });
      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('allows user to dismiss/ignore signal without placing any order', async () => {
    const ignoreSpy = vi.spyOn(strategyApi, 'ignoreSignal').mockResolvedValue({
      signal_id: 'sig-12345',
      status: 'IGNORED',
      actioned_at: new Date().toISOString(),
    });

    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <SignalActionModal
        isOpen={true}
        signal={mockSignal}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    const ignoreBtn = screen.getByText('Dismiss / Ignore');
    fireEvent.click(ignoreBtn);

    await waitFor(() => {
      expect(ignoreSpy).toHaveBeenCalledWith('sig-12345');
      expect(onSuccess).toHaveBeenCalledWith('Signal for TCS ignored.');
      expect(onClose).toHaveBeenCalled();
    });
  });
});
