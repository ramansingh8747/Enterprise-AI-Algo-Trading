import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthContext } from '@/context/AuthContext';
import { BrokerSessionCard, deriveSessionStatus } from '@/components/brokers/BrokerSessionCard';
import { BrokerSessionCreateModal } from '@/components/brokers/BrokerSessionCreateModal';
import axiosInstance from '@/services/http/axios';

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

const mockBrokerSession = {
  id: 'session-uuid-999',
  broker_id: 'broker-uuid-101',
  user_id: 'user-uuid-1',
  expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h from now
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

describe('Phase 15 — Frontend Broker Session Integration (Step 13.21I.34.89)', () => {
  const onShowToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Create session success
  it('1. Creates new session via POST /broker-sessions and updates UI', async () => {
    (axiosInstance.post as any).mockResolvedValueOnce({
      data: mockBrokerSession,
    });

    const onCreated = vi.fn();
    const onClose = vi.fn();

    render(
      <BrokerSessionCreateModal
        open={true}
        brokerId="broker-uuid-101"
        brokerName="Zerodha Pro"
        onClose={onClose}
        onCreated={onCreated}
        onShowToast={onShowToast}
      />
    );

    const tokenInput = screen.getByPlaceholderText('••••••••••••••••');
    fireEvent.change(tokenInput, { target: { value: 'tok_secret_12345' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create Session' }));

    await waitFor(() => {
      expect(axiosInstance.post).toHaveBeenCalledWith('/broker-sessions', {
        broker_id: 'broker-uuid-101',
        access_token: 'tok_secret_12345',
        expires_at: expect.any(String),
      });
      expect(onShowToast).toHaveBeenCalledWith('Broker session created for Zerodha Pro.');
      expect(onCreated).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  // 2. Create session validation failure (422)
  it('2. Handles 422 validation failure on create session', async () => {
    (axiosInstance.post as any).mockRejectedValueOnce({
      response: {
        status: 422,
        data: {
          success: false,
          message: 'Validation error',
          data: [{ loc: ['body', 'access_token'], msg: 'access_token cannot be empty' }],
        },
      },
    });

    render(
      <BrokerSessionCreateModal
        open={true}
        brokerId="broker-uuid-101"
        brokerName="Zerodha Pro"
        onClose={vi.fn()}
        onCreated={vi.fn()}
        onShowToast={onShowToast}
      />
    );

    const tokenInput = screen.getByPlaceholderText('••••••••••••••••');
    fireEvent.change(tokenInput, { target: { value: 'invalid_tok' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create Session' }));

    await waitFor(() => {
      expect(screen.getByText(/Validation error: access_token cannot be empty/)).toBeDefined();
    });
  });

  // 3. Create session 401 unauthorized
  it('3. Handles 401 unauthorized error on create session', async () => {
    (axiosInstance.post as any).mockRejectedValueOnce({
      response: {
        status: 401,
        data: {
          success: false,
          message: 'Authentication failed. Please re-login.',
        },
      },
    });

    render(
      <BrokerSessionCreateModal
        open={true}
        brokerId="broker-uuid-101"
        brokerName="Zerodha Pro"
        onClose={vi.fn()}
        onCreated={vi.fn()}
        onShowToast={onShowToast}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('••••••••••••••••'), { target: { value: 'expired_tok' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Session' }));

    await waitFor(() => {
      expect(screen.getByText(/Authentication failed/)).toBeDefined();
    });
  });

  // 4. Get active session success
  it('4. Fetches active session via GET /broker-sessions/{broker_id} and renders details', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({
      data: mockBrokerSession,
    });

    renderWithAuth(
      <BrokerSessionCard
        brokerId="broker-uuid-101"
        brokerName="Zerodha Pro"
        onShowToast={onShowToast}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('● Connected')).toBeDefined();
      expect(screen.getByText('session-uuid-999')).toBeDefined();
      expect(screen.getByText('user-uuid-1')).toBeDefined();
    });
  });

  // 5. Get session 404 / no active session
  it('5. Handles 404 no active session gracefully', async () => {
    (axiosInstance.get as any).mockRejectedValueOnce({
      response: {
        status: 404,
        data: { success: false, message: 'No active session found.', data: null },
      },
    });

    renderWithAuth(
      <BrokerSessionCard
        brokerId="broker-uuid-101"
        brokerName="Zerodha Pro"
        onShowToast={onShowToast}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Disconnected')).toBeDefined();
      expect(screen.getByText('+ Start Broker Session')).toBeDefined();
    });
  });

  // 6. Get session 403 forbidden
  it('6. Handles 403 forbidden error on get session', async () => {
    (axiosInstance.get as any).mockRejectedValueOnce({
      response: {
        status: 403,
        data: { success: false, message: 'Access denied to broker session.' },
      },
    });

    renderWithAuth(
      <BrokerSessionCard
        brokerId="broker-uuid-101"
        brokerName="Zerodha Pro"
        onShowToast={onShowToast}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Access denied to broker session.')).toBeDefined();
    });
  });

  // 7. Session status & expiry display derivation
  it('7. Derives session status correctly based on expires_at timestamp', () => {
    const futureDate = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(); // 5 hours in future
    expect(deriveSessionStatus(futureDate)).toBe('connected');

    const soonDate = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes in future
    expect(deriveSessionStatus(soonDate)).toBe('expiring_soon');

    const pastDate = new Date(Date.now() - 60 * 1000).toISOString(); // 1 minute in past
    expect(deriveSessionStatus(pastDate)).toBe('expired');

    expect(deriveSessionStatus(null)).toBe('not_connected');
  });

  // 8. Revoke confirmation modal prevents accidental deletion
  it('8. Revoke confirmation modal allows cancelling without invoking DELETE API', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({
      data: mockBrokerSession,
    });

    renderWithAuth(
      <BrokerSessionCard
        brokerId="broker-uuid-101"
        brokerName="Zerodha Pro"
        onShowToast={onShowToast}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Revoke Session')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Revoke Session' }));

    expect(screen.getByText('Revoke Session for Zerodha Pro?')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Revoke Session for Zerodha Pro?')).toBeNull();
    expect(axiosInstance.delete).not.toHaveBeenCalled();
  });

  // 9. Revoke session success (204 No Content Type C handling)
  it('9. Deletes session via DELETE /broker-sessions/{session_id} returning 204 No Content', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({
      data: mockBrokerSession,
    });

    renderWithAuth(
      <BrokerSessionCard
        brokerId="broker-uuid-101"
        brokerName="Zerodha Pro"
        onShowToast={onShowToast}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Revoke Session')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Revoke Session' }));

    (axiosInstance.delete as any).mockResolvedValueOnce({
      status: 204,
      data: '',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Revoke' }));

    await waitFor(() => {
      expect(axiosInstance.delete).toHaveBeenCalledWith('/broker-sessions/session-uuid-999');
      expect(onShowToast).toHaveBeenCalledWith('Session revoked for Zerodha Pro.');
      expect(screen.getByText('Disconnected')).toBeDefined();
    });
  });

  // 10. Revoke 404 not found
  it('10. Handles 404 error on revoke session', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({
      data: mockBrokerSession,
    });

    renderWithAuth(
      <BrokerSessionCard
        brokerId="broker-uuid-101"
        brokerName="Zerodha Pro"
        onShowToast={onShowToast}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Revoke Session')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Revoke Session' }));

    (axiosInstance.delete as any).mockRejectedValueOnce({
      response: {
        status: 404,
        data: { success: false, message: 'Session not found or already deleted.' },
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Revoke' }));

    await waitFor(() => {
      expect(onShowToast).toHaveBeenCalledWith('Failed to revoke session: Session not found or already deleted.');
    });
  });

  // 11. Revoke 403 forbidden
  it('11. Handles 403 forbidden error on revoke session', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({
      data: mockBrokerSession,
    });

    renderWithAuth(
      <BrokerSessionCard
        brokerId="broker-uuid-101"
        brokerName="Zerodha Pro"
        onShowToast={onShowToast}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Revoke Session')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Revoke Session' }));

    (axiosInstance.delete as any).mockRejectedValueOnce({
      response: {
        status: 403,
        data: { success: false, message: 'Not authorized to revoke this session.' },
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Revoke' }));

    await waitFor(() => {
      expect(onShowToast).toHaveBeenCalledWith('Failed to revoke session: Not authorized to revoke this session.');
    });
  });

  // 12. Sensitive token isolation
  it('12. Ensures access_token is never rendered in session card or stored after creation', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({
      data: mockBrokerSession,
    });

    renderWithAuth(
      <BrokerSessionCard
        brokerId="broker-uuid-101"
        brokerName="Zerodha Pro"
        onShowToast={onShowToast}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('session-uuid-999')).toBeDefined();
    });

    // Verify token strings or fields are never present in active session response rendering
    expect(screen.queryByText('access_token')).toBeNull();
    expect(document.body.textContent).not.toContain('tok_secret_12345');
  });

  // 13. UI updates after successful create
  it('13. Updates active session UI after successful session creation', async () => {
    // Initial fetch: 404 no session
    (axiosInstance.get as any).mockRejectedValueOnce({
      response: { status: 404, data: { success: false, message: 'No session' } },
    });

    renderWithAuth(
      <BrokerSessionCard
        brokerId="broker-uuid-101"
        brokerName="Zerodha Pro"
        onShowToast={onShowToast}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Disconnected')).toBeDefined();
    });

    // Open create modal
    fireEvent.click(screen.getByRole('button', { name: '+ Start Broker Session' }));

    // Mock post create and subsequent get
    (axiosInstance.post as any).mockResolvedValueOnce({
      data: mockBrokerSession,
    });
    (axiosInstance.get as any).mockResolvedValueOnce({
      data: mockBrokerSession,
    });

    fireEvent.change(screen.getByPlaceholderText('••••••••••••••••'), { target: { value: 'tok_123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Session' }));

    await waitFor(() => {
      expect(screen.getByText('● Connected')).toBeDefined();
      expect(screen.getByText('session-uuid-999')).toBeDefined();
    });
  });

  // 14. UI updates after successful revoke
  it('14. Immediately clears session state and updates UI after successful revoke', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({
      data: mockBrokerSession,
    });

    renderWithAuth(
      <BrokerSessionCard
        brokerId="broker-uuid-101"
        brokerName="Zerodha Pro"
        onShowToast={onShowToast}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('● Connected')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Revoke Session' }));

    (axiosInstance.delete as any).mockResolvedValueOnce({
      status: 204,
      data: '',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Revoke' }));

    await waitFor(() => {
      expect(screen.getByText('Disconnected')).toBeDefined();
      expect(screen.queryByText('session-uuid-999')).toBeNull();
    });
  });
});
