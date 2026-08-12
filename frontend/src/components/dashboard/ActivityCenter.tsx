import React from 'react';
import { PaperOrder } from './OrderForm';

interface ActivityCenterProps {
  orders: PaperOrder[];
}

export const ActivityCenter: React.FC<ActivityCenterProps> = ({ orders }) => {
  const recentActivities = orders.slice(0, 5);

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc' }}>
          Activity Timeline
        </h2>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          Recent Paper Trades
        </span>
      </div>

      {recentActivities.length === 0 ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', border: '1px dashed #334155', borderRadius: '0.5rem' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>No activity logged yet.</p>
          <span style={{ fontSize: '0.75rem' }}>Place your first paper trade to generate activity logs.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', position: 'relative' }}>
          {recentActivities.map((order, idx) => {
            const isBuy = order.side === 'BUY';
            const isCancelled = order.status === 'CANCELLED';

            return (
              <div key={order.id || idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', fontSize: '0.825rem' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: isCancelled ? 'rgba(239, 68, 68, 0.15)' : isBuy ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: `1px solid ${isCancelled ? 'rgba(239, 68, 68, 0.3)' : isBuy ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.9rem',
                  flexShrink: 0,
                }}>
                  {isCancelled ? '✕' : isBuy ? '⬆' : '⬇'}
                </div>

                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong style={{ color: '#f8fafc', fontWeight: 800 }}>{order.symbol}</strong>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        color: isBuy ? '#4ade80' : '#f87171',
                        background: isBuy ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '0.25rem',
                      }}>
                        {order.side}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.15rem', display: 'block' }}>
                      {order.quantity} shares @ ₹{order.price.toFixed(2)}
                    </span>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ fontSize: '0.85rem', color: '#38bdf8', display: 'block' }}>
                      ₹{(order.quantity * order.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </strong>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
