import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthContext } from '@/context/AuthContext';
import { brokerOrdersApi } from '@/services/api/brokerOrdersApi';
import { OrderForm } from '@/components/dashboard/OrderForm';
import { OrdersPage } from '@/pages/orders/OrdersPage';
import axiosInstance from '@/services/http/axios';
import {
  BrokerOrderCreateRequest,
  BrokerOrderModifyRequest,
  BrokerOrderCancelRequest,
  BrokerOrderResponse,
  BrokerOrderActionResultResponse,
} from '@/types/brokerOrder';

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

const mockOrderResponse: BrokerOrderResponse = {
  order_id: 'ORD-99001',
  symbol: 'INFY',
  side: 'BUY',
  quantity: '10',
  status: 'COMPLETE',
};

const mockActionResult: BrokerOrderActionResultResponse = {
  order_id: 'ORD-99001',
  success: true,
};

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

describe('Phase 19 — Frontend Broker Orders API & UI Integration (Step 13.21I.34.93)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. createOrder mapping
  it('1. brokerOrdersApi.createOrder maps payload correctly to POST /broker-orders/{broker_id}', async () => {
    (axiosInstance.post as any).mockResolvedValueOnce({ data: mockOrderResponse });

    const payload: BrokerOrderCreateRequest = {
      symbol: 'INFY',
      exchange: 'NSE',
      quantity: '10',
      side: 'BUY',
      order_type: 'MARKET',
      product: 'CNC',
      variety: 'regular',
    };

    const res = await brokerOrdersApi.createOrder('broker-uuid-1', payload);

    expect(axiosInstance.post).toHaveBeenCalledWith('/broker-orders/broker-uuid-1', payload);
    expect(res).toEqual(mockOrderResponse);
  });

  // 2. updateOrder mapping
  it('2. brokerOrdersApi.updateOrder maps payload correctly to PUT /broker-orders/{broker_id}/{order_id}', async () => {
    (axiosInstance.put as any).mockResolvedValueOnce({ data: mockActionResult });

    const payload: BrokerOrderModifyRequest = {
      symbol: 'INFY',
      exchange: 'NSE',
      quantity: '15',
      side: 'BUY',
      order_type: 'LIMIT',
      product: 'CNC',
      price: '1550.00',
    };

    const res = await brokerOrdersApi.updateOrder('broker-uuid-1', 'ORD-99001', payload);

    expect(axiosInstance.put).toHaveBeenCalledWith('/broker-orders/broker-uuid-1/ORD-99001', payload);
    expect(res).toEqual(mockActionResult);
  });

  // 3. cancelOrder mapping
  it('3. brokerOrdersApi.cancelOrder maps payload correctly to POST /broker-orders/{broker_id}/{order_id}/cancel', async () => {
    (axiosInstance.post as any).mockResolvedValueOnce({ data: mockActionResult });

    const payload: BrokerOrderCancelRequest = { variety: 'regular' };
    const res = await brokerOrdersApi.cancelOrder('broker-uuid-1', 'ORD-99001', payload);

    expect(axiosInstance.post).toHaveBeenCalledWith('/broker-orders/broker-uuid-1/ORD-99001/cancel', payload);
    expect(res).toEqual(mockActionResult);
  });

  // 4. getOrders mapping
  it('4. brokerOrdersApi.getOrders maps correctly to GET /broker-orders/{broker_id}', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({ data: [mockOrderResponse] });

    const res = await brokerOrdersApi.getOrders('broker-uuid-1');

    expect(axiosInstance.get).toHaveBeenCalledWith('/broker-orders/broker-uuid-1');
    expect(res).toEqual([mockOrderResponse]);
  });

  // 5. BUY success
  it('5. Submits BUY order in live mode and calls createOrder API', async () => {
    (axiosInstance.post as any).mockResolvedValueOnce({ data: mockOrderResponse });

    renderWithAuth(
      <OrderForm
        selectedBrokerId="broker-uuid-1"
        selectedBrokerName="Zerodha Pro"
        hasActiveSession={true}
        onClose={vi.fn()}
      />
    );

    // Switch to Live mode
    fireEvent.click(screen.getByRole('button', { name: /Live Broker Execution/i }));

    // Fill Symbol & Submit
    const symbolInput = screen.getByPlaceholderText('e.g. RELIANCE, TCS, INFY');
    fireEvent.change(symbolInput, { target: { value: 'INFY' } });

    fireEvent.click(screen.getByRole('button', { name: /Review Live BUY Order/i }));

    // Confirmation Modal should appear
    await waitFor(() => {
      expect(screen.getByText('Confirm Live Broker Order')).toBeDefined();
    });

    // Confirm execution
    fireEvent.click(screen.getByRole('button', { name: /Confirm & Submit BUY/i }));

    await waitFor(() => {
      expect(axiosInstance.post).toHaveBeenCalledWith('/broker-orders/broker-uuid-1', expect.objectContaining({
        symbol: 'INFY',
        side: 'BUY',
        quantity: '1',
      }));
      expect(screen.getByText(/Live Order Placed Successfully!/)).toBeDefined();
    });
  });

  // 6. SELL success
  it('6. Submits SELL order in live mode successfully', async () => {
    const sellResponse: BrokerOrderResponse = { ...mockOrderResponse, side: 'SELL' };
    (axiosInstance.post as any).mockResolvedValueOnce({ data: sellResponse });

    renderWithAuth(
      <OrderForm
        selectedBrokerId="broker-uuid-1"
        selectedBrokerName="Zerodha Pro"
        hasActiveSession={true}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Live Broker Execution/i }));
    fireEvent.click(screen.getByRole('button', { name: 'SELL' }));

    const symbolInput = screen.getByPlaceholderText('e.g. RELIANCE, TCS, INFY');
    fireEvent.change(symbolInput, { target: { value: 'TCS' } });

    fireEvent.click(screen.getByRole('button', { name: /Review Live SELL Order/i }));

    await waitFor(() => expect(screen.getByText('Confirm Live Broker Order')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: /Confirm & Submit SELL/i }));

    await waitFor(() => {
      expect(axiosInstance.post).toHaveBeenCalledWith('/broker-orders/broker-uuid-1', expect.objectContaining({
        symbol: 'TCS',
        side: 'SELL',
      }));
    });
  });

  // 7. Validation failure (422)
  it('7. Handles 422 validation failure on live order creation', async () => {
    (axiosInstance.post as any).mockRejectedValueOnce({
      response: { status: 422, data: { detail: [{ msg: 'Invalid quantity' }] } },
    });

    renderWithAuth(
      <OrderForm
        selectedBrokerId="broker-uuid-1"
        selectedBrokerName="Zerodha Pro"
        hasActiveSession={true}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Live Broker Execution/i }));

    const symbolInput = screen.getByPlaceholderText('e.g. RELIANCE, TCS, INFY');
    fireEvent.change(symbolInput, { target: { value: 'INFY' } });

    fireEvent.click(screen.getByRole('button', { name: /Review Live BUY Order/i }));
    await waitFor(() => expect(screen.getByText('Confirm Live Broker Order')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: /Confirm & Submit BUY/i }));

    await waitFor(() => {
      expect(screen.getByText(/API request failed|Invalid order parameters/)).toBeDefined();
    });
  });

  // 8. 401 Unauthorized
  it('8. Handles 401 unauthorized error on order creation', async () => {
    (axiosInstance.post as any).mockRejectedValueOnce({
      response: { status: 401, data: { message: 'Token expired' } },
    });

    renderWithAuth(
      <OrderForm
        selectedBrokerId="broker-uuid-1"
        selectedBrokerName="Zerodha Pro"
        hasActiveSession={true}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Live Broker Execution/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. RELIANCE, TCS, INFY'), { target: { value: 'INFY' } });

    fireEvent.click(screen.getByRole('button', { name: /Review Live BUY Order/i }));
    await waitFor(() => expect(screen.getByText('Confirm Live Broker Order')).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: /Confirm & Submit BUY/i }));

    await waitFor(() => {
      expect(screen.getByText(/Authentication required/)).toBeDefined();
    });
  });

  // 9. 403 Forbidden
  it('9. Handles 403 forbidden error on order creation', async () => {
    (axiosInstance.post as any).mockRejectedValueOnce({
      response: { status: 403, data: { message: 'Forbidden' } },
    });

    renderWithAuth(
      <OrderForm
        selectedBrokerId="broker-uuid-1"
        selectedBrokerName="Zerodha Pro"
        hasActiveSession={true}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Live Broker Execution/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. RELIANCE, TCS, INFY'), { target: { value: 'INFY' } });

    fireEvent.click(screen.getByRole('button', { name: /Review Live BUY Order/i }));
    await waitFor(() => expect(screen.getByText('Confirm Live Broker Order')).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: /Confirm & Submit BUY/i }));

    await waitFor(() => {
      expect(screen.getByText(/Access denied/)).toBeDefined();
    });
  });

  // 10. Missing broker session
  it('10. Blocks live submission if active session is missing', async () => {
    renderWithAuth(
      <OrderForm
        selectedBrokerId="broker-uuid-1"
        selectedBrokerName="Zerodha Pro"
        hasActiveSession={false}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Live Broker Execution/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. RELIANCE, TCS, INFY'), { target: { value: 'INFY' } });

    fireEvent.click(screen.getByRole('button', { name: /Review Live BUY Order/i }));

    await waitFor(() => {
      expect(screen.getByText(/No active broker session found/)).toBeDefined();
      expect(screen.queryByText('Confirm Live Broker Order')).toBeNull();
    });
  });

  // 11. Duplicate submit protection
  it('11. Disables submit action while request is in flight', async () => {
    (axiosInstance.post as any).mockReturnValueOnce(new Promise(() => {})); // pending request

    renderWithAuth(
      <OrderForm
        selectedBrokerId="broker-uuid-1"
        selectedBrokerName="Zerodha Pro"
        hasActiveSession={true}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Live Broker Execution/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. RELIANCE, TCS, INFY'), { target: { value: 'INFY' } });

    fireEvent.click(screen.getByRole('button', { name: /Review Live BUY Order/i }));
    await waitFor(() => expect(screen.getByText('Confirm Live Broker Order')).toBeDefined());

    const submitBtn = screen.getByRole('button', { name: /Confirm & Submit BUY/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(submitBtn.getAttribute('disabled')).not.toBeNull();
    });
  });

  // 12. Loading state
  it('12. Renders loading indicator while submitting order', async () => {
    (axiosInstance.post as any).mockReturnValueOnce(new Promise(() => {}));

    renderWithAuth(
      <OrderForm
        selectedBrokerId="broker-uuid-1"
        selectedBrokerName="Zerodha Pro"
        hasActiveSession={true}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Live Broker Execution/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. RELIANCE, TCS, INFY'), { target: { value: 'INFY' } });

    fireEvent.click(screen.getByRole('button', { name: /Review Live BUY Order/i }));
    await waitFor(() => expect(screen.getByText('Confirm Live Broker Order')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: /Confirm & Submit BUY/i }));

    await waitFor(() => {
      expect(screen.getByText('Submitting...')).toBeDefined();
    });
  });

  // 13. Confirmation modal prevents accidental submit
  it('13. Does not submit API request prior to user confirmation in modal', async () => {
    renderWithAuth(
      <OrderForm
        selectedBrokerId="broker-uuid-1"
        selectedBrokerName="Zerodha Pro"
        hasActiveSession={true}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Live Broker Execution/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. RELIANCE, TCS, INFY'), { target: { value: 'INFY' } });

    fireEvent.click(screen.getByRole('button', { name: /Review Live BUY Order/i }));

    await waitFor(() => expect(screen.getByText('Confirm Live Broker Order')).toBeDefined());

    // API should not have been called yet
    expect(axiosInstance.post).not.toHaveBeenCalled();
  });

  // 14. User confirmation submits live order
  it('14. Submits live order when user clicks Confirm in modal', async () => {
    (axiosInstance.post as any).mockResolvedValueOnce({ data: mockOrderResponse });

    renderWithAuth(
      <OrderForm
        selectedBrokerId="broker-uuid-1"
        selectedBrokerName="Zerodha Pro"
        hasActiveSession={true}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Live Broker Execution/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. RELIANCE, TCS, INFY'), { target: { value: 'INFY' } });

    fireEvent.click(screen.getByRole('button', { name: /Review Live BUY Order/i }));
    await waitFor(() => expect(screen.getByText('Confirm Live Broker Order')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: /Confirm & Submit BUY/i }));

    await waitFor(() => {
      expect(axiosInstance.post).toHaveBeenCalled();
    });
  });

  // 15. Live order history fetch success
  it('15. Fetches live broker orders in OrdersPage when switching to Live Broker Orders tab', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({ data: [mockOrderResponse] });

    renderWithAuth(<OrdersPage />);

    // Switch to Live Broker Orders tab
    fireEvent.click(screen.getByRole('button', { name: /Live Broker Orders/i }));

    await waitFor(() => {
      expect(axiosInstance.get).toHaveBeenCalledWith('/broker-orders/c2ce3afe-4468-49fc-9278-880111831207');
      expect(screen.getByText('ORD-99001')).toBeDefined();
      expect(screen.getByText('INFY')).toBeDefined();
    });
  });

  // 16. Empty live order history
  it('16. Displays empty notice when live broker order list is empty', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({ data: [] });

    renderWithAuth(<OrdersPage />);
    fireEvent.click(screen.getByRole('button', { name: /Live Broker Orders/i }));

    await waitFor(() => {
      expect(screen.getByText('No live broker orders found for this account.')).toBeDefined();
    });
  });

  // 17. Order history fetch error
  // 17. Order history fetch error
  it('17. Handles server error on live order history fetch', async () => {
    (axiosInstance.get as any).mockRejectedValueOnce({
      response: { status: 500, data: { message: 'Server error' } },
    });

    renderWithAuth(<OrdersPage />);
    fireEvent.click(screen.getByRole('button', { name: /Live Broker Orders/i }));

    await waitFor(() => {
      expect(screen.getByText(/Server error|Failed to load live broker orders/)).toBeDefined();
    });
  });

  // 18. Order update success
  it('18. Updates existing order via updateOrder API client method', async () => {
    (axiosInstance.put as any).mockResolvedValueOnce({ data: mockActionResult });

    const payload: BrokerOrderModifyRequest = {
      symbol: 'INFY',
      exchange: 'NSE',
      quantity: '20',
      side: 'BUY',
      order_type: 'LIMIT',
      product: 'CNC',
      price: '1500.00',
    };

    const res = await brokerOrdersApi.updateOrder('broker-uuid-1', 'ORD-99001', payload);

    expect(axiosInstance.put).toHaveBeenCalledWith('/broker-orders/broker-uuid-1/ORD-99001', payload);
    expect(res.success).toBe(true);
  });

  // 19. Order update error handling
  it('19. Handles error during updateOrder API call', async () => {
    (axiosInstance.put as any).mockRejectedValueOnce({
      response: { status: 404, data: { message: 'Order not found' } },
    });

    const payload: BrokerOrderModifyRequest = {
      symbol: 'INFY',
      exchange: 'NSE',
      quantity: '20',
      side: 'BUY',
      order_type: 'LIMIT',
      product: 'CNC',
    };

    await expect(brokerOrdersApi.updateOrder('broker-uuid-1', 'ORD-99001', payload)).rejects.toBeDefined();
  });

  // 20. Order cancellation confirmation modal
  it('20. Shows confirmation modal before cancelling a live order in OrdersPage', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({ data: [mockOrderResponse] });

    renderWithAuth(<OrdersPage />);
    fireEvent.click(screen.getByRole('button', { name: /Live Broker Orders/i }));

    await waitFor(() => expect(screen.getByText('ORD-99001')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Order' }));

    await waitFor(() => {
      expect(screen.getByText('Cancel Live Broker Order')).toBeDefined();
      expect(screen.getAllByText('ORD-99001').length).toBeGreaterThan(0);
    });
  });

  // 21. Order cancellation success
  it('21. Cancels live order upon confirmation in OrdersPage', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({ data: [mockOrderResponse] });

    renderWithAuth(<OrdersPage />);
    fireEvent.click(screen.getByRole('button', { name: /Live Broker Orders/i }));

    await waitFor(() => expect(screen.getByText('ORD-99001')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Order' }));
    await waitFor(() => expect(screen.getByText('Cancel Live Broker Order')).toBeDefined());

    (axiosInstance.post as any).mockResolvedValueOnce({ data: mockActionResult });
    (axiosInstance.get as any).mockResolvedValueOnce({ data: [] });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Cancel' }));

    await waitFor(() => {
      expect(axiosInstance.post).toHaveBeenCalledWith('/broker-orders/c2ce3afe-4468-49fc-9278-880111831207/ORD-99001/cancel', expect.anything());
    });
  });

  // 22. Order cancellation error handling
  it('22. Handles error during live order cancellation', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({ data: [mockOrderResponse] });

    renderWithAuth(<OrdersPage />);
    fireEvent.click(screen.getByRole('button', { name: /Live Broker Orders/i }));

    await waitFor(() => expect(screen.getByText('ORD-99001')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Order' }));
    await waitFor(() => expect(screen.getByText('Cancel Live Broker Order')).toBeDefined());

    (axiosInstance.post as any).mockRejectedValueOnce({
      response: { status: 400, data: { message: 'Order cannot be cancelled' } },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Cancel' }));

    await waitFor(() => {
      expect(screen.getByText(/Order cannot be cancelled|Failed to cancel live broker order/)).toBeDefined();
    });
  });

  // 23. Direct Type B response payload handling
  it('23. Handles direct Type B unwrapped order response payloads', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({
      data: [{ order_id: 'ORD-77', symbol: 'SBIN', side: 'BUY', quantity: '50', status: 'OPEN' }],
    });

    renderWithAuth(<OrdersPage />);
    fireEvent.click(screen.getByRole('button', { name: /Live Broker Orders/i }));

    await waitFor(() => {
      expect(screen.getByText('ORD-77')).toBeDefined();
      expect(screen.getByText('SBIN')).toBeDefined();
    });
  });

  // 24. Sensitive credentials not rendered
  it('24. Ensures api_key, api_secret, access_token are not rendered in Order UI', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({ data: [mockOrderResponse] });

    renderWithAuth(<OrdersPage />);
    fireEvent.click(screen.getByRole('button', { name: /Live Broker Orders/i }));

    await waitFor(() => expect(screen.getByText('ORD-99001')).toBeDefined());

    expect(screen.queryByText('api_key')).toBeNull();
    expect(screen.queryByText('api_secret')).toBeNull();
    expect(screen.queryByText('access_token')).toBeNull();
  });

  // 25. Sensitive credentials not logged
  it('25. Does not log response secrets or sensitive objects in console', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    (axiosInstance.get as any).mockResolvedValueOnce({ data: [mockOrderResponse] });

    renderWithAuth(<OrdersPage />);
    fireEvent.click(screen.getByRole('button', { name: /Live Broker Orders/i }));

    await waitFor(() => expect(screen.getByText('ORD-99001')).toBeDefined());

    expect(consoleSpy).not.toHaveBeenCalledWith(expect.objectContaining({ access_token: expect.anything() }));
    consoleSpy.mockRestore();
  });

  // 26. Paper/Live mode separation
  it('26. Keeps Paper Orders and Live Broker Orders strictly separated in OrdersPage', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({ data: [mockOrderResponse] });

    renderWithAuth(<OrdersPage />);

    // Default mode is Paper Orders
    expect(screen.getByText('Paper Order History (Simulated Sandbox)')).toBeDefined();

    // Switch to Live mode
    fireEvent.click(screen.getByRole('button', { name: /Live Broker Orders/i }));

    await waitFor(() => {
      expect(screen.getByText('Live Broker Orders (`GET /broker-orders/c2ce3afe-4468-49fc-9278-880111831207`)')).toBeDefined();
    });
  });

  // 27. Refresh state after order submit
  it('27. Triggers onLiveOrderCreated callback to refresh live order state upon successful placement', async () => {
    const onLiveOrderCreatedMock = vi.fn();
    (axiosInstance.post as any).mockResolvedValueOnce({ data: mockOrderResponse });

    renderWithAuth(
      <OrderForm
        selectedBrokerId="broker-uuid-1"
        selectedBrokerName="Zerodha Pro"
        hasActiveSession={true}
        onClose={vi.fn()}
        onLiveOrderCreated={onLiveOrderCreatedMock}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Live Broker Execution/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. RELIANCE, TCS, INFY'), { target: { value: 'INFY' } });

    fireEvent.click(screen.getByRole('button', { name: /Review Live BUY Order/i }));
    await waitFor(() => expect(screen.getByText('Confirm Live Broker Order')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: /Confirm & Submit BUY/i }));

    await waitFor(() => {
      expect(onLiveOrderCreatedMock).toHaveBeenCalledWith(mockOrderResponse);
    });
  });

  // 28. Selected broker ID prop usage
  it('28. Uses selected broker ID prop accurately in order creation API call', async () => {
    (axiosInstance.post as any).mockResolvedValueOnce({ data: mockOrderResponse });

    renderWithAuth(
      <OrderForm
        selectedBrokerId="custom-broker-uuid-999"
        selectedBrokerName="Custom Broker"
        hasActiveSession={true}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Live Broker Execution/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. RELIANCE, TCS, INFY'), { target: { value: 'WIPRO' } });

    fireEvent.click(screen.getByRole('button', { name: /Review Live BUY Order/i }));
    await waitFor(() => expect(screen.getByText('Confirm Live Broker Order')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: /Confirm & Submit BUY/i }));

    await waitFor(() => {
      expect(axiosInstance.post).toHaveBeenCalledWith('/broker-orders/custom-broker-uuid-999', expect.objectContaining({
        symbol: 'WIPRO',
      }));
    });
  });
});
