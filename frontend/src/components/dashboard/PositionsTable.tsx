import React from 'react';
import { BrokerPosition } from '@/types/brokerData';

interface PositionsTableProps {
  positions: BrokerPosition[];
  loading: boolean;
}

export const PositionsTable: React.FC<PositionsTableProps> = ({ positions, loading }) => {
  return (
    <div style={{
      background: '#1e293b',
      borderRadius: '0.75rem',
      border: '1px solid #334155',
      padding: '1.25rem',
      color: '#f8fafc',
    }}>
      <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', color: '#38bdf8' }}>Net Positions ({positions.length})</h3>

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Loading positions...</p>
      ) : positions.length === 0 ? (
        <p style={{ color: '#64748b' }}>No open net positions.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', fontSize: '0.875rem' }}>
                <th style={{ padding: '0.75rem' }}>Symbol</th>
                <th style={{ padding: '0.75rem' }}>Side</th>
                <th style={{ padding: '0.75rem' }}>Quantity</th>
                <th style={{ padding: '0.75rem' }}>Avg Price</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p, i) => {
                const isBuy = p.side.toLowerCase() === 'buy';
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #0f172a' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 600, color: '#f1f5f9' }}>{p.symbol}</td>
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
                        {p.side}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', color: '#cbd5e1' }}>{p.quantity}</td>
                    <td style={{ padding: '0.75rem', color: '#cbd5e1' }}>₹{parseFloat(p.avg_price).toFixed(2)}</td>
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
