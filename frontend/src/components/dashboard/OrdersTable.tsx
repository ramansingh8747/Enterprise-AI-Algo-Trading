import React from 'react';
import { BrokerOrder } from '@/types/brokerData';

interface OrdersTableProps {
  orders?: BrokerOrder[];
  loading?: boolean;
}

export const OrdersTable: React.FC<OrdersTableProps> = ({ orders = [], loading = false }) => {
  return (
    <div style={{
      background: '#1e293b',
      borderRadius: '0.75rem',
      border: '1px solid #334155',
      padding: '1.25rem',
      color: '#f8fafc',
    }}>
      <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', color: '#38bdf8' }}>Recent Orders ({orders.length})</h3>

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Loading orders...</p>
      ) : orders.length === 0 ? (
        <p style={{ color: '#64748b' }}>No orders found for this account.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', fontSize: '0.875rem' }}>
                <th style={{ padding: '0.75rem' }}>Order ID</th>
                <th style={{ padding: '0.75rem' }}>Symbol</th>
                <th style={{ padding: '0.75rem' }}>Side</th>
                <th style={{ padding: '0.75rem' }}>Quantity</th>
                <th style={{ padding: '0.75rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => {
                const isBuy = o.side.toLowerCase() === 'buy';
                const statusColor = o.status.toLowerCase() === 'complete' ? '#4ade80' : '#facc15';
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #0f172a' }}>
                    <td style={{ padding: '0.75rem', fontFamily: 'monospace', color: '#94a3b8' }}>{o.order_id}</td>
                    <td style={{ padding: '0.75rem', fontWeight: 600, color: '#f1f5f9' }}>{o.symbol}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        backgroundColor: isBuy ? 'rgba(74, 222, 128, 0.15)' : 'rgba(248, 113, 113, 0.15)',
                        color: isBuy ? '#4ade80' : '#f87171',
                        textTransform: 'uppercase',
                      }}>
                        {o.side}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', color: '#cbd5e1' }}>{o.quantity}</td>
                    <td style={{ padding: '0.75rem', fontWeight: 600, color: statusColor, textTransform: 'capitalize' }}>
                      {o.status}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default OrdersTable;
