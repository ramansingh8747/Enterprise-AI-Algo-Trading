import React from 'react';
import { BrokerHolding } from '@/types/brokerData';

interface HoldingsTableProps {
  holdings: BrokerHolding[];
  loading: boolean;
}

export const HoldingsTable: React.FC<HoldingsTableProps> = ({ holdings, loading }) => {
  return (
    <div style={{
      background: '#1e293b',
      borderRadius: '0.75rem',
      border: '1px solid #334155',
      padding: '1.25rem',
      color: '#f8fafc',
    }}>
      <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', color: '#38bdf8' }}>Holdings ({holdings.length})</h3>

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Loading holdings...</p>
      ) : holdings.length === 0 ? (
        <p style={{ color: '#64748b' }}>No holdings found in connected account.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', fontSize: '0.875rem' }}>
                <th style={{ padding: '0.75rem' }}>Symbol</th>
                <th style={{ padding: '0.75rem' }}>Quantity</th>
                <th style={{ padding: '0.75rem' }}>Avg Price</th>
                <th style={{ padding: '0.75rem' }}>Total Value</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h, i) => {
                const qty = parseFloat(h.quantity);
                const avgPrice = parseFloat(h.average_price);
                const totalValue = qty * avgPrice;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #0f172a' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 600, color: '#f1f5f9' }}>{h.symbol}</td>
                    <td style={{ padding: '0.75rem', color: '#cbd5e1' }}>{h.quantity}</td>
                    <td style={{ padding: '0.75rem', color: '#cbd5e1' }}>₹{avgPrice.toFixed(2)}</td>
                    <td style={{ padding: '0.75rem', fontWeight: 600, color: '#38bdf8' }}>₹{totalValue.toFixed(2)}</td>
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
