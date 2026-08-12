import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import TradingJournalPage from '@/pages/journal/TradingJournalPage';
import { OrdersPage } from '@/pages/orders/OrdersPage';
import { SignalHistory } from '@/components/strategy/SignalHistory';
import { tradingJournalApi } from '@/services/api/tradingJournalApi';
import { brokerOrdersApi } from '@/services/api/brokerOrdersApi';
import { strategyApi } from '@/services/api/strategyApi';

vi.mock('@/services/api/tradingJournalApi', () => ({
  tradingJournalApi: {
    listEntries: vi.fn(),
    createEntry: vi.fn(),
    getEntry: vi.fn(),
    updateEntry: vi.fn(),
    deleteEntry: vi.fn(),
  },
}));

vi.mock('@/services/api/brokerOrdersApi', () => ({
  brokerOrdersApi: {
    getOrders: vi.fn().mockResolvedValue([]),
    cancelOrder: vi.fn(),
  },
}));

vi.mock('@/services/api/strategyApi', () => ({
  strategyApi: {
    getSignalHistory: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/hooks/useWebSocketSubscription', () => ({
  useWebSocketSubscription: vi.fn(),
}));


const mockServerJournalEntries = [
  {
    id: 'j-entry-101',
    user_id: 'user-1',
    symbol: 'RELIANCE',
    side: 'BUY',
    quantity: 10,
    entry_price: 2800.0,
    exit_price: 2900.0,
    realized_pnl: 1000.0,
    result: 'WIN',
    notes: 'Breakout trade',
    paper_trade_id: 'PT-99',
    created_at: '2026-08-11T10:00:00Z',
  },
];

describe('STEP 13.21I.34.133 — Trading Journal Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Journal page loads server data and renders linked source badge', async () => {
    (tradingJournalApi.listEntries as any).mockResolvedValue(mockServerJournalEntries);

    render(
      <MemoryRouter>
        <TradingJournalPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Trading Journal Intelligence')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getAllByText('RELIANCE')[0]).toBeInTheDocument();
      expect(screen.getByText('Paper: PT-99')).toBeInTheDocument();
    });
  });

  it('2. OrdersPage allows launching prefilled journal creation modal for orders', async () => {
    (brokerOrdersApi.getOrders as any).mockResolvedValue([
      {
        order_id: 'ORD-LIVE-777',
        symbol: 'INFY',
        side: 'BUY',
        quantity: 25,
        status: 'COMPLETE',
      },
    ]);

    render(
      <MemoryRouter>
        <OrdersPage />
      </MemoryRouter>
    );

    // Switch to Live Broker Orders
    const liveTab = screen.getByText(/Live Broker Orders/i);
    fireEvent.click(liveTab);

    await waitFor(() => {
      expect(screen.getByText('ORD-LIVE-777')).toBeInTheDocument();
    });

    // Click + Journal action button
    const journalBtn = screen.getByRole('button', { name: /\+ Journal/i });
    fireEvent.click(journalBtn);

    await waitFor(() => {
      expect(screen.getByText('📖 Add Journal Entry')).toBeInTheDocument();
      expect(screen.getByText(/Linked: Broker Order #ORD-LIVE-777/i)).toBeInTheDocument();
    });
  });

  it('3. SignalHistory allows launching prefilled journal creation modal from strategy signals', async () => {
    (strategyApi.getSignalHistory as any).mockResolvedValue([
      {
        id: 'sig-uuid-55',
        symbol: 'TCS',
        side: 'BUY',
        quantity: 10,
        price: 3600.0,
        status: 'EXECUTED',
        created_at: '2026-08-11T12:00:00Z',
      },
    ]);

    render(
      <MemoryRouter>
        <SignalHistory strategyDefinitionId="def-1" instanceId="inst-1" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('TCS')).toBeInTheDocument();
    });

    const journalBtn = screen.getByRole('button', { name: /\+ Journal/i });
    fireEvent.click(journalBtn);

    await waitFor(() => {
      expect(screen.getByText('📖 Add Journal Entry')).toBeInTheDocument();
      expect(screen.getByText(/Linked: Strategy Signal #sig-uuid/i)).toBeInTheDocument();
    });
  });

  it('4. Handles duplicate journal creation error gracefully in modal', async () => {
    (tradingJournalApi.listEntries as any).mockResolvedValue([]);
    (tradingJournalApi.createEntry as any).mockRejectedValueOnce({
      status: 409,
      message: 'Journal entry for this trade/order context already exists.',
    });

    render(
      <MemoryRouter>
        <TradingJournalPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Trading Journal Intelligence')).toBeInTheDocument();
    });

    // Open add modal
    const addBtn = screen.getByRole('button', { name: /\+ Add Journal Entry/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByText('📖 Add Journal Entry')).toBeInTheDocument();
    });

    // Fill symbol and submit
    const symbolInput = screen.getByPlaceholderText('e.g. RELIANCE');
    fireEvent.change(symbolInput, { target: { value: 'SBIN' } });


    const saveBtn = screen.getByRole('button', { name: /Save Journal Entry/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText(/A journal entry for this trade\/order context already exists/i)).toBeInTheDocument();
    });
  });

  it('5. Ensures credential isolation in DOM', async () => {
    (tradingJournalApi.listEntries as any).mockResolvedValue(mockServerJournalEntries);

    const { container } = render(
      <MemoryRouter>
        <TradingJournalPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Trading Journal Intelligence')).toBeInTheDocument();
    });

    const html = container.innerHTML.toLowerCase();
    expect(html).not.toContain('api_key');
    expect(html).not.toContain('api_secret');
    expect(html).not.toContain('access_token');
    expect(html).not.toContain('password');
  });
});
