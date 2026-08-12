import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '@/types/alerts';
import { markAsRead, markAllAsRead, clearAllAlerts } from '@/services/paperTrading/alertService';

interface SmartAlertsProps {
  alerts: Alert[];
  onRefresh?: () => void;
}

export const SmartAlerts: React.FC<SmartAlertsProps> = ({ alerts, onRefresh }) => {
  const navigate = useNavigate();
  const [confirmClear, setConfirmClear] = useState(false);

  const unreadCount = alerts.filter(a => !a.read).length;

  const handleAlertClick = (alert: Alert) => {
    markAsRead(alert.id);
    onRefresh?.();
    if (alert.route) {
      navigate(alert.route);
    }
  };

  const handleMarkAllRead = () => {
    markAllAsRead();
    onRefresh?.();
  };

  const handleClearAll = () => {
    clearAllAlerts();
    setConfirmClear(false);
    onRefresh?.();
  };

  const getSeverityStyle = (severity: Alert['severity']) => {
    switch (severity) {
      case 'CRITICAL':
        return { color: '#f87171', border: 'rgba(239, 68, 68, 0.3)', bg: 'rgba(239, 68, 68, 0.1)', icon: '🚨' };
      case 'WARNING':
        return { color: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)', bg: 'rgba(245, 158, 11, 0.1)', icon: '⚠️' };
      case 'SUCCESS':
        return { color: '#4ade80', border: 'rgba(34, 197, 94, 0.3)', bg: 'rgba(34, 197, 94, 0.1)', icon: '✅' };
      default:
        return { color: '#38bdf8', border: 'rgba(56, 189, 248, 0.3)', bg: 'rgba(56, 189, 248, 0.1)', icon: 'ℹ️' };
    }
  };

  return (
    <section style={{
      background: '#0f172a',
      borderRadius: '0.85rem',
      border: '1px solid rgba(148, 163, 184, 0.18)',
      padding: '1.25rem',
      color: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc' }}>
            Smart Alerts
          </h2>
          {unreadCount > 0 && (
            <span style={{
              background: '#ef4444',
              color: '#ffffff',
              fontSize: '0.7rem',
              fontWeight: 800,
              padding: '0.15rem 0.5rem',
              borderRadius: '1rem',
            }}>
              {unreadCount} unread
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#38bdf8',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Mark all read
            </button>
          )}
          {alerts.length > 0 && (
            <button
              onClick={() => setConfirmClear(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Clear All Confirmation */}
      {confirmClear && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '0.5rem',
          padding: '0.75rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.8rem',
        }}>
          <span style={{ color: '#fca5a5', fontWeight: 600 }}>Clear all paper trading alerts?</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setConfirmClear(false)} style={{ background: '#1e293b', border: 'none', color: '#cbd5e1', padding: '0.25rem 0.6rem', borderRadius: '0.25rem', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleClearAll} style={{ background: '#ef4444', border: 'none', color: '#ffffff', padding: '0.25rem 0.6rem', borderRadius: '0.25rem', fontWeight: 700, cursor: 'pointer' }}>Clear</button>
          </div>
        </div>
      )}

      {/* Alerts List */}
      {alerts.length === 0 ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', border: '1px dashed #334155', borderRadius: '0.5rem' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>No active alerts.</p>
          <span style={{ fontSize: '0.75rem' }}>You're all caught up!</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '280px', overflowY: 'auto' }}>
          {alerts.map((alert) => {
            const style = getSeverityStyle(alert.severity);
            return (
              <div
                key={alert.id}
                onClick={() => handleAlertClick(alert)}
                style={{
                  background: alert.read ? 'rgba(15, 23, 42, 0.4)' : style.bg,
                  border: `1px solid ${alert.read ? 'rgba(148, 163, 184, 0.12)' : style.border}`,
                  borderRadius: '0.5rem',
                  padding: '0.75rem 0.9rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  cursor: alert.route ? 'pointer' : 'default',
                  transition: 'all 0.15s ease',
                  opacity: alert.read ? 0.75 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                  <span style={{ fontSize: '1rem', marginTop: '0.1rem' }}>{style.icon}</span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong style={{ fontSize: '0.85rem', color: alert.read ? '#cbd5e1' : '#f8fafc', fontWeight: alert.read ? 600 : 800 }}>
                        {alert.title}
                      </strong>
                      {!alert.read && (
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8' }} />
                      )}
                    </div>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4 }}>
                      {alert.message}
                    </p>
                  </div>
                </div>

                <span style={{ fontSize: '0.7rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                  {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
