import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthContext } from '@/context/AuthContext';
import { BrokerDataPanel } from '@/components/brokers/BrokerDataPanel';
import axiosInstance from '@/services/http/axios';
import { BrokerProfile, BrokerHolding, BrokerPosition, BrokerOrder, BrokerQuote } from '@/types/brokerData';

vi.mock('@/services/http/axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    defaults: { headers: { common: {} } },
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

const mockAdminUser = {
  id: 'user-uuid-1',
  email: 'admin@platform.ai',
  username: 'admin',
  full_name: 'System Admin',
  role: 'ADMIN',
  is_active: true,
  is_verified: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockProfile: BrokerProfile = {
  account_id: 'ZB1234',
  account_type: 'individual',
  currency: 'INR',
};

const mockHoldings: BrokerHolding[] = [
  { symbol: 'INFY', quantity: '10', average_price: '1500.00' },
  { symbol: 'TCS', quantity: '5', average_price: '3400.50' },
];

const mockPositions: BrokerPosition[] = [
  { symbol: 'RELIANCE', quantity: '15', side: 'buy', avg_price: '2450.75' },
];

const mockOrders: BrokerOrder[] = [
  { order_id: 'ORD-1001', symbol: 'TATAMOTORS', side: 'buy', quantity: '50', status: 'COMPLETE' },
];

const mockQuotes: BrokerQuote[] = [
  { symbol: 'INFY', bid: '1498.50', ask: '1499.00', last_price: '1498.75' },
  { symbol: 'TCS', bid: '3399.00', ask: '3401.00', last_price: '3400.00' },
];

const renderWithAuth = (ui: React.ReactNode, user = mockAdminUser) => {
  return render(
    <AuthContext.Provider
      value={{
        user,
        loading: false,
        isAuthenticated: true,
        login: vi.fn(),
        logout: vi.fn(),
        updateProfile: vi.fn(),
        changePassword: vi.fn(),
      }}
    >
      {ui}
    </AuthContext.Provider>
  );
};

describe('Phase 17 — Frontend Broker Data Integration (Step 13.21I.34.90)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Profile success
  it('1. Fetches broker profile via GET /broker-data/{broker_id}/profile and renders details', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({
      data: mockProfile,
    });

    renderWithAuth(
      <BrokerDataPanel brokerId="broker-uuid-101" brokerName="Zerodha Pro" />
    );

    await waitFor(() => {
      expect(axiosInstance.get).toHaveBeenCalledWith('/broker-data/broker-uuid-101/profile');
      expect(screen.getByText('ZB1234')).toBeDefined();
      expect(screen.getByText('individual')).toBeDefined();
      expect(screen.getByText('INR')).toBeDefined();
    });
  });

  // 2. Profile 404
  it('2. Handles 404 error on broker profile fetch', async () => {
    (axiosInstance.get as any).mockRejectedValueOnce({
      response: { status: 404, data: { success: false, message: 'Broker session unavailable' } },
    });

    renderWithAuth(
      <BrokerDataPanel brokerId="broker-uuid-101" brokerName="Zerodha Pro" />
    );

    await waitFor(() => {
      expect(screen.getByText(/Broker session unavailable or no data found/)).toBeDefined();
    });
  });

  // 3. Profile 403
  it('3. Handles 403 forbidden error on broker profile fetch', async () => {
    (axiosInstance.get as any).mockRejectedValueOnce({
      response: { status: 403, data: { success: false, message: 'Access denied' } },
    });

    renderWithAuth(
      <BrokerDataPanel brokerId="broker-uuid-101" brokerName="Zerodha Pro" />
    );

    await waitFor(() => {
      expect(screen.getByText(/Access denied to broker data/)).toBeDefined();
    });
  });

  // 4. Holdings success
  it('4. Fetches broker holdings via GET /broker-data/{broker_id}/holdings', async () => {
    // Initial profile fetch
    (axiosInstance.get as any).mockResolvedValueOnce({ data: mockProfile });

    renderWithAuth(
      <BrokerDataPanel brokerId="broker-uuid-101" brokerName="Zerodha Pro" />
    );

    await waitFor(() => {
      expect(screen.getByText('ZB1234')).toBeDefined();
    });

    // Switch to holdings tab
    (axiosInstance.get as any).mockResolvedValueOnce({ data: mockHoldings });
    fireEvent.click(screen.getByRole('button', { name: 'holdings' }));

    await waitFor(() => {
      expect(axiosInstance.get).toHaveBeenCalledWith('/broker-data/broker-uuid-101/holdings');
      expect(screen.getByText('INFY')).toBeDefined();
      expect(screen.getByText('10')).toBeDefined();
      expect(screen.getByText('₹1500.00')).toBeDefined();
    });
  });

  // 5. Holdings empty state
  it('5. Renders empty holdings notice when holdings list is empty', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({ data: mockProfile });

    renderWithAuth(
      <BrokerDataPanel brokerId="broker-uuid-101" brokerName="Zerodha Pro" />
    );

    await waitFor(() => expect(screen.getByText('ZB1234')).toBeDefined());

    (axiosInstance.get as any).mockResolvedValueOnce({ data: [] });
    fireEvent.click(screen.getByRole('button', { name: 'holdings' }));

    await waitFor(() => {
      expect(screen.getByText('No holdings found.')).toBeDefined();
    });
  });

  // 6. Holdings error
  it('6. Handles server error on holdings fetch', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({ data: mockProfile });
    renderWithAuth(<BrokerDataPanel brokerId="broker-uuid-101" brokerName="Zerodha Pro" />);

    await waitFor(() => expect(screen.getByText('ZB1234')).toBeDefined());

    (axiosInstance.get as any).mockRejectedValueOnce({
      response: { status: 500, data: { success: false, message: 'Internal server error' } },
    });
    fireEvent.click(screen.getByRole('button', { name: 'holdings' }));

    await waitFor(() => {
      expect(screen.getByText('Internal server error')).toBeDefined();
    });
  });

  // 7. Positions success
  it('7. Fetches broker positions via GET /broker-data/{broker_id}/positions', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({ data: mockProfile });
    renderWithAuth(<BrokerDataPanel brokerId="broker-uuid-101" brokerName="Zerodha Pro" />);

    await waitFor(() => expect(screen.getByText('ZB1234')).toBeDefined());

    (axiosInstance.get as any).mockResolvedValueOnce({ data: mockPositions });
    fireEvent.click(screen.getByRole('button', { name: 'positions' }));

    await waitFor(() => {
      expect(axiosInstance.get).toHaveBeenCalledWith('/broker-data/broker-uuid-101/positions');
      expect(screen.getByText('RELIANCE')).toBeDefined();
      expect(screen.getByText('buy')).toBeDefined();
      expect(screen.getByText('₹2450.75')).toBeDefined();
    });
  });

  // 8. Positions empty state
  it('8. Renders empty positions notice when positions list is empty', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({ data: mockProfile });
    renderWithAuth(<BrokerDataPanel brokerId="broker-uuid-101" brokerName="Zerodha Pro" />);

    await waitFor(() => expect(screen.getByText('ZB1234')).toBeDefined());

    (axiosInstance.get as any).mockResolvedValueOnce({ data: [] });
    fireEvent.click(screen.getByRole('button', { name: 'positions' }));

    await waitFor(() => {
      expect(screen.getByText('No open positions.')).toBeDefined();
    });
  });

  // 9. Orders success
  it('9. Fetches broker orders via GET /broker-data/{broker_id}/orders', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({ data: mockProfile });
    renderWithAuth(<BrokerDataPanel brokerId="broker-uuid-101" brokerName="Zerodha Pro" />);

    await waitFor(() => expect(screen.getByText('ZB1234')).toBeDefined());

    (axiosInstance.get as any).mockResolvedValueOnce({ data: mockOrders });
    fireEvent.click(screen.getByRole('button', { name: 'orders' }));

    await waitFor(() => {
      expect(axiosInstance.get).toHaveBeenCalledWith('/broker-data/broker-uuid-101/orders');
      expect(screen.getByText('ORD-1001')).toBeDefined();
      expect(screen.getByText('TATAMOTORS')).toBeDefined();
      expect(screen.getByText('COMPLETE')).toBeDefined();
    });
  });

  // 10. Orders empty state
  it('10. Renders empty orders notice when order history is empty', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({ data: mockProfile });
    renderWithAuth(<BrokerDataPanel brokerId="broker-uuid-101" brokerName="Zerodha Pro" />);

    await waitFor(() => expect(screen.getByText('ZB1234')).toBeDefined());

    (axiosInstance.get as any).mockResolvedValueOnce({ data: [] });
    fireEvent.click(screen.getByRole('button', { name: 'orders' }));

    await waitFor(() => {
      expect(screen.getByText('No orders found.')).toBeDefined();
    });
  });

  // 11. Orders error
  it('11. Handles error state on orders fetch', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({ data: mockProfile });
    renderWithAuth(<BrokerDataPanel brokerId="broker-uuid-101" brokerName="Zerodha Pro" />);

    await waitFor(() => expect(screen.getByText('ZB1234')).toBeDefined());

    (axiosInstance.get as any).mockRejectedValueOnce({
      response: { status: 401, data: { success: false, message: 'Auth error' } },
    });
    fireEvent.click(screen.getByRole('button', { name: 'orders' }));

    await waitFor(() => {
      expect(screen.getByText(/Authentication required/)).toBeDefined();
    });
  });

  // 12. Quotes success
  it('12. Fetches real-time quotes via GET /broker-data/{broker_id}/quotes', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({ data: mockProfile });
    renderWithAuth(<BrokerDataPanel brokerId="broker-uuid-101" brokerName="Zerodha Pro" />);

    await waitFor(() => expect(screen.getByText('ZB1234')).toBeDefined());

    (axiosInstance.get as any).mockResolvedValueOnce({ data: mockQuotes });
    fireEvent.click(screen.getByRole('button', { name: 'quotes' }));

    await waitFor(() => {
      expect(screen.getByText('INFY')).toBeDefined();
      expect(screen.getByText('₹1498.50')).toBeDefined();
      expect(screen.getByText('₹1499.00')).toBeDefined();
    });
  });

  // 13. Quotes empty state
  it('13. Renders empty quotes notice when quotes response is empty', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({ data: mockProfile });
    renderWithAuth(<BrokerDataPanel brokerId="broker-uuid-101" brokerName="Zerodha Pro" />);

    await waitFor(() => expect(screen.getByText('ZB1234')).toBeDefined());

    (axiosInstance.get as any).mockResolvedValueOnce({ data: [] });
    fireEvent.click(screen.getByRole('button', { name: 'quotes' }));

    await waitFor(() => {
      expect(screen.getByText('No quote data.')).toBeDefined();
    });
  });

  // 14. Quotes contract query parameter handling
  it('14. Passes query parameters ?symbols=... correctly as defined in frozen contract', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({ data: mockProfile });
    renderWithAuth(<BrokerDataPanel brokerId="broker-uuid-101" brokerName="Zerodha Pro" />);

    await waitFor(() => expect(screen.getByText('ZB1234')).toBeDefined());

    (axiosInstance.get as any).mockResolvedValueOnce({ data: mockQuotes });
    fireEvent.click(screen.getByRole('button', { name: 'quotes' }));

    await waitFor(() => {
      expect(axiosInstance.get).toHaveBeenCalledWith('/broker-data/broker-uuid-101/quotes?symbols=INFY&symbols=TCS&symbols=RELIANCE');
    });
  });

  // 15. Sensitive credential isolation
  it('15. Ensures sensitive credential fields (api_key, api_secret, access_token) are never rendered', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({ data: mockProfile });
    renderWithAuth(<BrokerDataPanel brokerId="broker-uuid-101" brokerName="Zerodha Pro" />);

    await waitFor(() => expect(screen.getByText('ZB1234')).toBeDefined());

    expect(screen.queryByText('api_key')).toBeNull();
    expect(screen.queryByText('api_secret')).toBeNull();
    expect(screen.queryByText('access_token')).toBeNull();
  });

  // 16. No credential logging
  it('16. Does not log response objects or expose secrets in console/DOM', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    (axiosInstance.get as any).mockResolvedValueOnce({ data: mockProfile });

    renderWithAuth(<BrokerDataPanel brokerId="broker-uuid-101" brokerName="Zerodha Pro" />);

    await waitFor(() => expect(screen.getByText('ZB1234')).toBeDefined());

    expect(consoleSpy).not.toHaveBeenCalledWith(expect.objectContaining({ api_key: expect.anything() }));
    consoleSpy.mockRestore();
  });

  // 17. Broker switching loads data for selected broker
  it('17. Loads new profile when brokerId changes', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({ data: mockProfile });

    const { rerender } = renderWithAuth(
      <BrokerDataPanel brokerId="broker-uuid-101" brokerName="Zerodha Pro" />
    );

    await waitFor(() => expect(screen.getByText('ZB1234')).toBeDefined());

    const mockProfile2: BrokerProfile = {
      account_id: 'AO9999',
      account_type: 'individual',
      currency: 'INR',
    };
    (axiosInstance.get as any).mockResolvedValueOnce({ data: mockProfile2 });

    rerender(
      <AuthContext.Provider
        value={{
          user: mockAdminUser,
          loading: false,
          isAuthenticated: true,
          login: vi.fn(),
          logout: vi.fn(),
          updateProfile: vi.fn(),
          changePassword: vi.fn(),
        }}
      >
        <BrokerDataPanel brokerId="broker-uuid-202" brokerName="Angel One Live" />
      </AuthContext.Provider>
    );

    await waitFor(() => {
      expect(axiosInstance.get).toHaveBeenCalledWith('/broker-data/broker-uuid-202/profile');
      expect(screen.getByText('AO9999')).toBeDefined();
    });
  });

  // 18. Stale broker data prevention
  it('18. Immediately clears stale broker data when brokerId prop changes', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({ data: mockProfile });

    const { rerender } = renderWithAuth(
      <BrokerDataPanel brokerId="broker-uuid-101" brokerName="Zerodha Pro" />
    );

    await waitFor(() => expect(screen.getByText('ZB1234')).toBeDefined());

    (axiosInstance.get as any).mockReturnValueOnce(new Promise(() => {})); // pending request

    rerender(
      <AuthContext.Provider
        value={{
          user: mockAdminUser,
          loading: false,
          isAuthenticated: true,
          login: vi.fn(),
          logout: vi.fn(),
          updateProfile: vi.fn(),
          changePassword: vi.fn(),
        }}
      >
        <BrokerDataPanel brokerId="broker-uuid-202" brokerName="Angel One Live" />
      </AuthContext.Provider>
    );

    // Stale ZB1234 account ID should immediately disappear
    expect(screen.queryByText('ZB1234')).toBeNull();
  });

  // 19. Direct Type B response handling
  it('19. Handles direct Type B response payloads cleanly', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({ data: mockProfile });
    renderWithAuth(<BrokerDataPanel brokerId="broker-uuid-101" brokerName="Zerodha Pro" />);

    await waitFor(() => expect(screen.getByText('ZB1234')).toBeDefined());

    (axiosInstance.get as any).mockResolvedValueOnce({
      data: [
        { symbol: 'NIFTY50', quantity: '100', average_price: '22000.00' },
      ],
    });

    // Switch to holdings
    fireEvent.click(screen.getByRole('button', { name: 'holdings' }));

    await waitFor(() => {
      expect(screen.getByText('NIFTY50')).toBeDefined();
      expect(screen.getByText('100')).toBeDefined();
    });
  });

  // 20. Decimal precision string safety
  it('20. Preserves string types for Decimal fields without numerical precision loss', async () => {
    const decimalHolding: BrokerHolding = {
      symbol: 'ACC',
      quantity: '999999999999999.9999',
      average_price: '123456789.987654321',
    };

    (axiosInstance.get as any).mockResolvedValueOnce({ data: mockProfile });
    renderWithAuth(<BrokerDataPanel brokerId="broker-uuid-101" brokerName="Zerodha Pro" />);

    await waitFor(() => expect(screen.getByText('ZB1234')).toBeDefined());

    (axiosInstance.get as any).mockResolvedValueOnce({ data: [decimalHolding] });
    fireEvent.click(screen.getByRole('button', { name: 'holdings' }));

    await waitFor(() => {
      expect(screen.getByText('999999999999999.9999')).toBeDefined();
      expect(screen.getByText('₹123456789.987654321')).toBeDefined();
    });
  });
});
