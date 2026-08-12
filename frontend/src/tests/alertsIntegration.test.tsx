import { describe, it, expect, vi, beforeEach } from 'vitest';
import { alertsApi, ServerAlert } from '../services/api/alertsApi';
import { fetchServerAlerts, addAlert, markAsRead, clearAllAlerts } from '../services/paperTrading/alertService';

vi.mock('../services/api/alertsApi', () => {
  const mockAlerts: ServerAlert[] = [
    {
      id: 'srv-alert-1',
      user_id: 'user-123',
      type: 'RISK',
      severity: 'WARNING',
      title: 'Risk Limit Exceeded',
      message: 'Max daily loss threshold reached.',
      read: false,
      route: '/portfolio',
      created_at: '2026-08-11T20:00:00Z',
    },
  ];

  return {
    alertsApi: {
      getAlerts: vi.fn().mockResolvedValue(mockAlerts),
      createAlert: vi.fn().mockImplementation((payload) =>
        Promise.resolve({
          id: 'srv-alert-2',
          user_id: 'user-123',
          type: payload.type || 'SYSTEM',
          severity: payload.severity || 'INFO',
          title: payload.title,
          message: payload.message,
          read: false,
          route: payload.route || null,
          created_at: '2026-08-11T21:00:00Z',
        })
      ),
      markAsRead: vi.fn().mockResolvedValue({
        id: 'srv-alert-1',
        user_id: 'user-123',
        type: 'RISK',
        severity: 'WARNING',
        title: 'Risk Limit Exceeded',
        message: 'Max daily loss threshold reached.',
        read: true,
        route: '/portfolio',
        created_at: '2026-08-11T20:00:00Z',
      }),
      markAllAsRead: vi.fn().mockResolvedValue({ success: true, marked_count: 1 }),
      deleteAlert: vi.fn().mockResolvedValue(undefined),
      clearAllAlerts: vi.fn().mockResolvedValue(undefined),
    },
  };
});

describe('STEP 13.21I.34.136 — System Notifications & Risk Alerts Server Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('1. Loads server alerts and updates storage cache', async () => {
    const alerts = await fetchServerAlerts();
    expect(alerts.length).toBe(1);
    expect(alerts[0].title).toBe('Risk Limit Exceeded');
    expect(alerts[0].severity).toBe('WARNING');
    expect(alertsApi.getAlerts).toHaveBeenCalledTimes(1);
  });

  it('2. Synchronizes new alert creation with server API', async () => {
    const created = addAlert({
      type: 'ORDER',
      severity: 'SUCCESS',
      title: 'Order Executed',
      message: 'BUY RELIANCE 10 Qty filled.',
    });

    expect(created.title).toBe('Order Executed');
    expect(alertsApi.createAlert).toHaveBeenCalledWith({
      type: 'ORDER',
      severity: 'SUCCESS',
      title: 'Order Executed',
      message: 'BUY RELIANCE 10 Qty filled.',
      route: undefined,
    });
  });

  it('3. Marks alert as read on server API', async () => {
    await fetchServerAlerts();
    const updated = markAsRead('srv-alert-1');
    expect(updated.find(a => a.id === 'srv-alert-1')?.read).toBe(true);
    expect(alertsApi.markAsRead).toHaveBeenCalledWith('srv-alert-1');
  });


  it('4. Clears all alerts on server API', async () => {
    const cleared = clearAllAlerts();
    expect(cleared.length).toBe(0);
    expect(alertsApi.clearAllAlerts).toHaveBeenCalledTimes(1);
  });
});
