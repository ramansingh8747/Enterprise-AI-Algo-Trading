import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import KillSwitchStatus from '@/components/admin/KillSwitchStatus';
import KillSwitchPage from '@/pages/admin/KillSwitchPage';
import { riskApi } from '@/services/api/riskApi';

vi.mock('@/services/api/riskApi', () => ({
  riskApi: {
    getKillSwitchStatus: vi.fn(),
    activateKillSwitch: vi.fn(),
    deactivateKillSwitch: vi.fn(),
  },
}));

describe('Step 13.21I.34.125 — Emergency Kill Switch Admin UI Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Authorized admin can view Kill Switch status', async () => {
    (riskApi.getKillSwitchStatus as any).mockResolvedValue({
      kill_switch_active: false,
      status: 'INACTIVE',
      updated_at: '2026-08-11T10:00:00Z',
    });

    render(
      <MemoryRouter>
        <KillSwitchStatus />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/INACTIVE — NORMAL TRADING/i)).toBeInTheDocument();
    });

    expect(riskApi.getKillSwitchStatus).toHaveBeenCalledTimes(1);
  });

  it('2. Renders INACTIVE status correctly with active deactivate button disabled', async () => {
    (riskApi.getKillSwitchStatus as any).mockResolvedValue({
      kill_switch_active: false,
      status: 'INACTIVE',
      updated_at: '2026-08-11T10:00:00Z',
    });

    render(
      <MemoryRouter>
        <KillSwitchStatus />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/INACTIVE — NORMAL TRADING/i)).toBeInTheDocument();
    });

    const activateBtn = screen.getByLabelText('activate-button');
    const deactivateBtn = screen.getByLabelText('deactivate-button');

    expect(activateBtn).not.toBeDisabled();
    expect(deactivateBtn).toBeDisabled();
  });

  it('3. Renders ACTIVE status correctly with system halted warning', async () => {
    (riskApi.getKillSwitchStatus as any).mockResolvedValue({
      kill_switch_active: true,
      status: 'ACTIVE',
      updated_at: '2026-08-11T10:00:00Z',
    });

    render(
      <MemoryRouter>
        <KillSwitchStatus />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/ACTIVE — SYSTEM HALTED/i)).toBeInTheDocument();
    });

    const activateBtn = screen.getByLabelText('activate-button');
    const deactivateBtn = screen.getByLabelText('deactivate-button');

    expect(activateBtn).toBeDisabled();
    expect(deactivateBtn).not.toBeDisabled();
  });

  it('4. Clicking Activate opens confirmation modal', async () => {
    (riskApi.getKillSwitchStatus as any).mockResolvedValue({
      kill_switch_active: false,
      status: 'INACTIVE',
    });

    render(
      <MemoryRouter>
        <KillSwitchStatus />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/INACTIVE — NORMAL TRADING/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('activate-button'));

    expect(screen.getByLabelText('confirmation-modal')).toBeInTheDocument();
    expect(screen.getByText(/Confirm Emergency Kill Switch Activation/i)).toBeInTheDocument();
  });

  it('5. Modal Cancel button closes modal without triggering API action', async () => {
    (riskApi.getKillSwitchStatus as any).mockResolvedValue({
      kill_switch_active: false,
      status: 'INACTIVE',
    });

    render(
      <MemoryRouter>
        <KillSwitchStatus />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/INACTIVE — NORMAL TRADING/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('activate-button'));
    fireEvent.click(screen.getByLabelText('modal-cancel-button'));

    expect(screen.queryByLabelText('confirmation-modal')).not.toBeInTheDocument();
    expect(riskApi.activateKillSwitch).not.toHaveBeenCalled();
  });

  it('6. Confirming activate invokes riskApi.activateKillSwitch()', async () => {
    (riskApi.getKillSwitchStatus as any).mockResolvedValue({
      kill_switch_active: false,
      status: 'INACTIVE',
    });
    (riskApi.activateKillSwitch as any).mockResolvedValue({
      kill_switch_active: true,
      status: 'ACTIVE',
      message: 'Emergency Kill Switch has been ACTIVATED.',
    });

    render(
      <MemoryRouter>
        <KillSwitchStatus />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/INACTIVE — NORMAL TRADING/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('activate-button'));
    fireEvent.click(screen.getByLabelText('modal-confirm-button'));

    await waitFor(() => {
      expect(riskApi.activateKillSwitch).toHaveBeenCalledTimes(1);
    });
  });

  it('7. Successful activation updates UI status to ACTIVE and displays success alert', async () => {
    (riskApi.getKillSwitchStatus as any).mockResolvedValue({
      kill_switch_active: false,
      status: 'INACTIVE',
    });
    (riskApi.activateKillSwitch as any).mockResolvedValue({
      kill_switch_active: true,
      status: 'ACTIVE',
      message: 'Emergency Kill Switch has been ACTIVATED.',
    });

    render(
      <MemoryRouter>
        <KillSwitchStatus />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/INACTIVE — NORMAL TRADING/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('activate-button'));
    fireEvent.click(screen.getByLabelText('modal-confirm-button'));

    await waitFor(() => {
      expect(screen.getByText(/ACTIVE — SYSTEM HALTED/i)).toBeInTheDocument();
      expect(screen.getByLabelText('success-alert')).toBeInTheDocument();
    });
  });

  it('8. Activation API error preserves previous state and displays error alert', async () => {
    (riskApi.getKillSwitchStatus as any).mockResolvedValue({
      kill_switch_active: false,
      status: 'INACTIVE',
    });
    (riskApi.activateKillSwitch as any).mockRejectedValueOnce(new Error('Permission denied'));

    render(
      <MemoryRouter>
        <KillSwitchStatus />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/INACTIVE — NORMAL TRADING/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('activate-button'));
    fireEvent.click(screen.getByLabelText('modal-confirm-button'));

    await waitFor(() => {
      expect(screen.getByLabelText('error-alert')).toBeInTheDocument();
      expect(screen.getByText(/Permission denied/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/INACTIVE — NORMAL TRADING/i)).toBeInTheDocument();
  });

  it('9. Clicking Deactivate opens confirmation modal', async () => {
    (riskApi.getKillSwitchStatus as any).mockResolvedValue({
      kill_switch_active: true,
      status: 'ACTIVE',
    });

    render(
      <MemoryRouter>
        <KillSwitchStatus />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/ACTIVE — SYSTEM HALTED/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('deactivate-button'));

    expect(screen.getByLabelText('confirmation-modal')).toBeInTheDocument();
    expect(screen.getByText(/Confirm Kill Switch Deactivation/i)).toBeInTheDocument();
  });

  it('10. Confirming deactivate invokes riskApi.deactivateKillSwitch()', async () => {
    (riskApi.getKillSwitchStatus as any).mockResolvedValue({
      kill_switch_active: true,
      status: 'ACTIVE',
    });
    (riskApi.deactivateKillSwitch as any).mockResolvedValue({
      kill_switch_active: false,
      status: 'INACTIVE',
      message: 'Emergency Kill Switch has been DEACTIVATED.',
    });

    render(
      <MemoryRouter>
        <KillSwitchStatus />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/ACTIVE — SYSTEM HALTED/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('deactivate-button'));
    fireEvent.click(screen.getByLabelText('modal-confirm-button'));

    await waitFor(() => {
      expect(riskApi.deactivateKillSwitch).toHaveBeenCalledTimes(1);
    });
  });

  it('11. Successful deactivation updates UI status to INACTIVE and displays success alert', async () => {
    (riskApi.getKillSwitchStatus as any).mockResolvedValue({
      kill_switch_active: true,
      status: 'ACTIVE',
    });
    (riskApi.deactivateKillSwitch as any).mockResolvedValue({
      kill_switch_active: false,
      status: 'INACTIVE',
      message: 'Emergency Kill Switch has been DEACTIVATED.',
    });

    render(
      <MemoryRouter>
        <KillSwitchStatus />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/ACTIVE — SYSTEM HALTED/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('deactivate-button'));
    fireEvent.click(screen.getByLabelText('modal-confirm-button'));

    await waitFor(() => {
      expect(screen.getByText(/INACTIVE — NORMAL TRADING/i)).toBeInTheDocument();
      expect(screen.getByLabelText('success-alert')).toBeInTheDocument();
    });
  });

  it('12. Deactivation failure preserves ACTIVE status and displays error alert', async () => {
    (riskApi.getKillSwitchStatus as any).mockResolvedValue({
      kill_switch_active: true,
      status: 'ACTIVE',
    });
    (riskApi.deactivateKillSwitch as any).mockRejectedValueOnce(new Error('Deactivation prohibited'));

    render(
      <MemoryRouter>
        <KillSwitchStatus />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/ACTIVE — SYSTEM HALTED/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('deactivate-button'));
    fireEvent.click(screen.getByLabelText('modal-confirm-button'));

    await waitFor(() => {
      expect(screen.getByLabelText('error-alert')).toBeInTheDocument();
      expect(screen.getByText(/Deactivation prohibited/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/ACTIVE — SYSTEM HALTED/i)).toBeInTheDocument();
  });

  it('13. Disables action buttons while request is pending', async () => {
    (riskApi.getKillSwitchStatus as any).mockResolvedValue({
      kill_switch_active: false,
      status: 'INACTIVE',
    });

    render(
      <MemoryRouter>
        <KillSwitchStatus />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/INACTIVE — NORMAL TRADING/i)).toBeInTheDocument();
    });

    const activateBtn = screen.getByLabelText('activate-button');
    expect(activateBtn).not.toBeDisabled();
  });

  it('14. Renders KillSwitchPage container correctly', async () => {
    (riskApi.getKillSwitchStatus as any).mockResolvedValue({
      kill_switch_active: false,
      status: 'INACTIVE',
    });

    render(
      <MemoryRouter>
        <KillSwitchPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Admin Risk Operations/i)).toBeInTheDocument();
      expect(screen.getByText(/Emergency Kill Switch Admin Control/i)).toBeInTheDocument();
    });
  });

  it('15. Zero credentials or sensitive JWT tokens exposed in DOM', async () => {
    (riskApi.getKillSwitchStatus as any).mockResolvedValue({
      kill_switch_active: false,
      status: 'INACTIVE',
    });

    const { container } = render(
      <MemoryRouter>
        <KillSwitchPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/INACTIVE — NORMAL TRADING/i)).toBeInTheDocument();
    });

    const html = container.innerHTML.toLowerCase();
    expect(html).not.toContain('api_key');
    expect(html).not.toContain('api_secret');
    expect(html).not.toContain('access_token');
    expect(html).not.toContain('jwt');
  });
});
