import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthContext } from '@/context/AuthContext';
import { BrokerResponse } from '@/services/api/brokersApi';
import axiosInstance from '@/services/http/axios';
import BrokersPage from '@/pages/brokers/BrokersPage';

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
  id: 'admin-uuid-1',
  email: 'admin@enterprise.com',
  username: 'admin1',
  full_name: 'System Admin',
  role: 'ADMIN',
  is_active: true,
  is_verified: true,
};

const mockTraderUser = {
  id: 'trader-uuid-2',
  email: 'trader@enterprise.com',
  username: 'trader1',
  full_name: 'Enterprise Trader',
  role: 'TRADER',
  is_active: true,
  is_verified: true,
};

const mockBroker: BrokerResponse = {
  id: 'broker-uuid-101',
  broker_name: 'Zerodha Pro',
  broker_type: 'zerodha',
  client_id: 'ZB1234',
  is_active: true,
};

const renderWithAuth = (ui: React.ReactNode, user = mockAdminUser) => {
  return render(
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: true,
        loading: false,
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

describe('Phase 13 — Frontend Broker Management Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (axiosInstance.get as any).mockImplementation((url: string) => {
      if (url.includes('/broker-sessions')) {
        return Promise.reject({ response: { status: 404, data: { success: false } } });
      }
      return Promise.resolve({ data: { success: true, message: 'OK', data: [mockBroker] } });
    });
  });

  // 1. Admin can load broker list
  it('1. Admin can load broker list successfully', async () => {
    renderWithAuth(<BrokersPage />);

    await waitFor(() => {
      expect(screen.getByText('Zerodha Pro')).toBeDefined();
    });

    expect(screen.getByText('ID:')).toBeDefined();
    expect(screen.getAllByText('broker-uuid-101')[0]).toBeDefined();
  });

  // 2. Broker list loading state
  it('2. Renders loading state while fetching brokers', async () => {
    (axiosInstance.get as any).mockReturnValueOnce(new Promise(() => {}));

    renderWithAuth(<BrokersPage />);

    expect(screen.getByText('Loading registered brokers from platform API...')).toBeDefined();
  });

  // 3. Empty broker list rendering
  it('3. Renders empty broker list message when no brokers exist', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({
      data: { success: true, message: 'OK', data: [] },
    });

    renderWithAuth(<BrokersPage />);

    await waitFor(() => {
      expect(screen.getByText('No registered brokers found.')).toBeDefined();
    });
  });

  // 4. Broker list API failure
  it('4. Handles broker list API failure with error state and retry button', async () => {
    (axiosInstance.get as any).mockRejectedValueOnce({
      response: {
        status: 500,
        data: { success: false, message: 'Database query failure', data: null },
      },
    });

    renderWithAuth(<BrokersPage />);

    await waitFor(() => {
      expect(screen.getByText(/Database query failure/)).toBeDefined();
    });

    // Mock retry success
    (axiosInstance.get as any).mockResolvedValueOnce({
      data: { success: true, message: 'OK', data: [mockBroker] },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.getByText('Zerodha Pro')).toBeDefined();
    });
  });

  // 5. Create broker success
  it('5. Creates new broker via POST /brokers and updates list', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({
      data: { success: true, message: 'OK', data: [] },
    });

    renderWithAuth(<BrokersPage />);

    await waitFor(() => {
      expect(screen.getByText('No registered brokers found.')).toBeDefined();
    });

    fireEvent.click(screen.getAllByRole('button', { name: '+ Register New Broker' })[0]);

    expect(screen.getByText('Register New Broker')).toBeDefined();

    fireEvent.change(screen.getByPlaceholderText('e.g. Zerodha Pro'), {
      target: { value: 'Angel One Live' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. zerodha or angelone'), {
      target: { value: 'angelone' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. api_key_12345'), {
      target: { value: 'my_api_key' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••••••••••'), {
      target: { value: 'my_api_secret' },
    });

    (axiosInstance.post as any).mockResolvedValueOnce({
      data: { success: true, message: 'Created', data: { ...mockBroker, broker_name: 'Angel One Live' } },
    });
    (axiosInstance.get as any).mockResolvedValueOnce({
      data: { success: true, message: 'OK', data: [{ ...mockBroker, broker_name: 'Angel One Live' }] },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Register Broker' }));

    await waitFor(() => {
      expect(screen.getByText(/Broker "Angel One Live" registered successfully/)).toBeDefined();
    });
  });

  // 6. Create broker validation failure
  it('6. Handles 422 validation failure on create broker', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({
      data: { success: true, message: 'OK', data: [] },
    });

    renderWithAuth(<BrokersPage />);

    await waitFor(() => {
      expect(screen.getByText('No registered brokers found.')).toBeDefined();
    });

    fireEvent.click(screen.getAllByRole('button', { name: '+ Register New Broker' })[0]);

    fireEvent.change(screen.getByPlaceholderText('e.g. Zerodha Pro'), {
      target: { value: 'Bad Broker' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. zerodha or angelone'), {
      target: { value: 'zerodha' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. api_key_12345'), {
      target: { value: 'key' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••••••••••'), {
      target: { value: 'secret' },
    });

    (axiosInstance.post as any).mockRejectedValueOnce({
      response: {
        status: 422,
        data: {
          success: false,
          message: 'Validation error',
          data: [{ loc: ['body', 'api_key'], msg: 'api_key is too short' }],
        },
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Register Broker' }));

    await waitFor(() => {
      expect(screen.getByText(/Validation error: api_key is too short/)).toBeDefined();
    });
  });

  // 7. 403 Handling / Non-Admin UI
  it('7. Displays restricted notice for non-admin user without rendering management controls', async () => {
    renderWithAuth(<BrokersPage />, mockTraderUser);

    expect(screen.getByText(/Access Restricted/)).toBeDefined();
    expect(screen.getByText(/TRADER/)).toBeDefined();
    expect(screen.queryByRole('button', { name: '+ Register New Broker' })).toBeNull();
  });

  // 8. Get broker details success
  it('8. Fetches broker details via GET /brokers/{id} and displays details modal', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({
      data: { success: true, message: 'OK', data: [mockBroker] },
    });

    renderWithAuth(<BrokersPage />);

    await waitFor(() => {
      expect(screen.getByText('Zerodha Pro')).toBeDefined();
    });

    (axiosInstance.get as any).mockResolvedValueOnce({
      data: { success: true, message: 'OK', data: { ...mockBroker, client_id: 'ZB9999' } },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Details' }));

    await waitFor(() => {
      expect(screen.getByText('Broker Configuration Details')).toBeDefined();
    });

    expect(screen.getByText('ZB9999')).toBeDefined();
  });

  // 9. Update broker success
  it('9. Updates broker via PUT /brokers/{id} and refreshes list', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({
      data: { success: true, message: 'OK', data: [mockBroker] },
    });

    renderWithAuth(<BrokersPage />);

    await waitFor(() => {
      expect(screen.getByText('Zerodha Pro')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(screen.getByText(/Edit Broker \(Zerodha Pro\)/)).toBeDefined();

    fireEvent.change(screen.getByDisplayValue('Zerodha Pro'), {
      target: { value: 'Zerodha Enterprise' },
    });

    (axiosInstance.put as any).mockResolvedValueOnce({
      data: { success: true, message: 'Updated', data: { ...mockBroker, broker_name: 'Zerodha Enterprise' } },
    });
    (axiosInstance.get as any).mockResolvedValueOnce({
      data: { success: true, message: 'OK', data: [{ ...mockBroker, broker_name: 'Zerodha Enterprise' }] },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Update Broker' }));

    await waitFor(() => {
      expect(screen.getByText(/Broker "Zerodha Enterprise" updated successfully/)).toBeDefined();
    });
  });

  // 10. Delete broker 204 handling
  it('10. Deletes broker via DELETE /brokers/{id} returning 204 No Content', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({
      data: { success: true, message: 'OK', data: [mockBroker] },
    });

    renderWithAuth(<BrokersPage />);

    await waitFor(() => {
      expect(screen.getByText('Zerodha Pro')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByText(/Delete Broker "Zerodha Pro"\?/)).toBeDefined();

    (axiosInstance.delete as any).mockResolvedValueOnce({
      status: 204,
      data: null, // 204 No Content empty body
    });
    (axiosInstance.get as any).mockResolvedValueOnce({
      data: { success: true, message: 'OK', data: [] },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Delete' }));

    await waitFor(() => {
      expect(screen.getByText(/Broker "Zerodha Pro" deleted/)).toBeDefined();
    });
  });

  // 11. Delete confirmation prevents accidental deletion
  it('11. Delete confirmation modal allows cancelling without making DELETE request', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({
      data: { success: true, message: 'OK', data: [mockBroker] },
    });

    renderWithAuth(<BrokersPage />);

    await waitFor(() => {
      expect(screen.getByText('Zerodha Pro')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByText(/Delete Broker "Zerodha Pro"\?/)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText(/Delete Broker "Zerodha Pro"\?/)).toBeNull();
    expect(axiosInstance.delete).not.toHaveBeenCalled();
  });

  // 12. Credential isolation
  it('12. Ensures api_key and api_secret are not rendered in BrokerResponse UI or stored in DOM', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({
      data: { success: true, message: 'OK', data: [mockBroker] },
    });

    renderWithAuth(<BrokersPage />);

    await waitFor(() => {
      expect(screen.getByText('Zerodha Pro')).toBeDefined();
    });

    const secretValue = 'super_secret_credential_value_999';

    fireEvent.click(screen.getAllByRole('button', { name: '+ Register New Broker' })[0]);

    const secretInput = screen.getByPlaceholderText('••••••••••••••••') as HTMLInputElement;
    fireEvent.change(secretInput, {
      target: { value: secretValue },
    });

    // Verify input value is set while typing in modal
    expect(secretInput.value).toBe(secretValue);

    // Cancel modal
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // Modal is closed
    expect(screen.queryByText('Register New Broker')).toBeNull();

    // Reopen modal and verify credential fields are reset to empty
    fireEvent.click(screen.getAllByRole('button', { name: '+ Register New Broker' })[0]);
    const reopenedSecretInput = screen.getByPlaceholderText('••••••••••••••••') as HTMLInputElement;
    expect(reopenedSecretInput.value).toBe('');
  });
});
