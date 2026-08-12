import { Alert } from '@/types/alerts';
import { alertsApi, ServerAlert } from '../api/alertsApi';

const ALERTS_STORAGE_KEY = 'algo_trading_alerts';

const DEFAULT_ALERTS: Alert[] = [
  {
    id: 'system-init-1',
    type: 'SYSTEM',
    severity: 'INFO',
    title: 'Paper Mode Active',
    message: 'Virtual sandbox trading engine initialized with ₹10,00,000 starting margin.',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    read: false,
    route: '/dashboard',
  },
  {
    id: 'risk-limit-1',
    type: 'RISK',
    severity: 'INFO',
    title: 'Risk Limits Enforced',
    message: 'Max Order: ₹1,00,000 • Max Daily Loss: ₹10,00,000 • Trade Risk: 2.0%',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    read: false,
    route: '/portfolio',
  },
  {
    id: 'broker-status-1',
    type: 'BROKER',
    severity: 'SUCCESS',
    title: 'Read-Only Session Connected',
    message: 'Zerodha Kite mock session active. Live execution disabled.',
    timestamp: new Date(Date.now() - 900000).toISOString(),
    read: false,
    route: '/brokers',
  },
];

const mapServerAlertToAlert = (sa: ServerAlert): Alert => ({
  id: sa.id,
  type: (sa.type as Alert['type']) || 'SYSTEM',
  severity: (sa.severity as Alert['severity']) || 'INFO',
  title: sa.title,
  message: sa.message,
  read: sa.read,
  route: sa.route || undefined,
  timestamp: sa.created_at,
});

export const getAlerts = (): Alert[] => {
  try {
    const stored = localStorage.getItem(ALERTS_STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(DEFAULT_ALERTS));
      return DEFAULT_ALERTS;
    }
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : DEFAULT_ALERTS;
  } catch {
    return DEFAULT_ALERTS;
  }
};

export const saveAlerts = (alerts: Alert[]): void => {
  try {
    localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(alerts.slice(0, 100)));
  } catch (_err) {
    // Ignored localStorage access error
  }
};

export const fetchServerAlerts = async (): Promise<Alert[]> => {
  try {
    const serverAlerts = await alertsApi.getAlerts();
    const mapped = serverAlerts.map(mapServerAlertToAlert);
    saveAlerts(mapped);
    return mapped;
  } catch (_err) {
    return getAlerts();
  }
};

export const addAlert = (alert: Omit<Alert, 'id' | 'timestamp' | 'read'> & { id?: string }): Alert => {
  const alerts = getAlerts();
  const newId = alert.id || `alert-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

  const existing = alerts.find(a => a.id === newId);
  if (existing) return existing;

  const newAlert: Alert = {
    ...alert,
    id: newId,
    timestamp: new Date().toISOString(),
    read: false,
  };

  const updated = [newAlert, ...alerts];
  saveAlerts(updated);

  // Fire-and-forget sync to server if authenticated
  alertsApi.createAlert({
    type: alert.type,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    route: alert.route,
  }).catch(() => {
    // Ignored unauthenticated/offline failure
  });

  return newAlert;
};

export const markAsRead = (id: string): Alert[] => {
  const alerts = getAlerts();
  const updated = alerts.map(a => a.id === id ? { ...a, read: true } : a);
  saveAlerts(updated);

  if (!id.startsWith('system-') && !id.startsWith('risk-') && !id.startsWith('broker-')) {
    alertsApi.markAsRead(id).catch(() => {});
  }

  return updated;
};

export const markAllAsRead = (): Alert[] => {
  const alerts = getAlerts();
  const updated = alerts.map(a => ({ ...a, read: true }));
  saveAlerts(updated);

  alertsApi.markAllAsRead().catch(() => {});

  return updated;
};

export const removeAlert = (id: string): Alert[] => {
  const alerts = getAlerts();
  const updated = alerts.filter(a => a.id !== id);
  saveAlerts(updated);

  if (!id.startsWith('system-') && !id.startsWith('risk-') && !id.startsWith('broker-')) {
    alertsApi.deleteAlert(id).catch(() => {});
  }

  return updated;
};

export const clearAllAlerts = (): Alert[] => {
  saveAlerts([]);
  alertsApi.clearAllAlerts().catch(() => {});
  return [];
};

export const getUnreadCount = (): number => {
  return getAlerts().filter(a => !a.read).length;
};
