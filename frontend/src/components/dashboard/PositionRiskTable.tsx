import React from 'react';
import { MonitoredPosition } from '@/types/positionMonitor';

interface PositionRiskTableProps {
  positions: MonitoredPosition[];
  onSelectPosition?: (position: MonitoredPosition) => void;
}

export const PositionRiskTable: React.FC<PositionRiskTableProps> = ({ positions, onSelectPosition }) => {
  const getRiskBadge = (status: string) => {
    if (status === 'SAFE') return { color: '#4ade80', bg: 'rgba(74, 222, 128, 0.15)', border: 'rgba(74, 222, 128, 0.3)' };
    if (status === 'WARNING') return { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)', border: 'rgba(251, 191, 36, 0.3)' };
    return { color: '#f87171', bg: 'rgba(248, 113, 113, 0.15)', border: 'rgba(248, 113, 113, 0.3)' };
  };

  if (!positions || positions.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', background: '#0f172a', borderRadius: '0.75rem', border: '1px dashed #334155' }}>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#94a3b8' }}>No positions match the selected filters.</p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto', background: '#1e293b', borderRadius: '0.75rem', border: '1px solid #334155', padding: '1rem' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase' }}>
            <th style={{ padding: '0.75rem' }}>Symbol</th>
            <th style={{ padding: '0.75rem' }}>Quantity</th>
            <th style={{ padding: '0.75rem' }}>Avg Price</th>
            <th style={{ padding: '0.75rem' }}>Cur Price</th>
            <th style={{ padding: '0.75rem' }}>P&L (₹)</th>
            <th style={{ padding: '0.75rem' }}>Exposure</th>
            <th style={{ padding: '0.75rem' }}>Risk Status</th>
            <th style={{ padding: '0.75rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {positions.map(p => {
            const badge = getRiskBadge(p.riskStatus);
            const isPositive = p.pnl >= 0;

            return (
              <tr
                key={p.symbol}
                onClick={() => onSelectPosition?.(p)}
                style={{
                  borderBottom: '1px solid #0f172a',
                  cursor: onSelectPosition ? 'pointer' : 'default',
                  transition: 'background 0.15s ease',
                }}
              >
                <td style={{ padding: '0.75rem', fontWeight: 800, color: '#f8fafc' }}>{p.symbol}</td>
                <td style={{ padding: '0.75rem', color: '#cbd5e1' }}>{p.quantity}</td>
                <td style={{ padding: '0.75rem', color: '#cbd5e1' }}>₹{p.averagePrice.toFixed(2)}</td>
                <td style={{ padding: '0.75rem', color: '#38bdf8', fontWeight: 600 }}>₹{p.currentPrice.toFixed(2)}</td>
                <td style={{ padding: '0.75rem', fontWeight: 800, color: isPositive ? '#4ade80' : '#f87171' }}>
                  {isPositive ? '+' : ''}₹{p.pnl.toFixed(2)} ({isPositive ? '+' : ''}{p.pnlPercent.toFixed(1)}%)
                </td>
                <td style={{ padding: '0.75rem', color: '#cbd5e1' }}>{p.exposurePercent.toFixed(1)}%</td>
                <td style={{ padding: '0.75rem' }}>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    color: badge.color,
                    background: badge.bg,
                    border: `1px solid ${badge.border}`,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '0.25rem',
                  }}>
                    {p.riskStatus}
                  </span>
                </td>
                <td style={{ padding: '0.75rem' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPosition?.(p);
                    }}
                    style={{
                      padding: '0.25rem 0.55rem',
                      background: '#0284c7',
                      border: 'none',
                      borderRadius: '0.25rem',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    View Risk
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
