import React from 'react';

export const MarketIndicesBar: React.FC = () => {
  const indices = [
    { name: 'NIFTY 50', value: '24,350.10', change: '+145.20', changePercent: '+0.60%', isUp: true },
    { name: 'BANK NIFTY', value: '52,180.45', change: '-85.30', changePercent: '-0.16%', isUp: false },
    { name: 'SENSEX', value: '79,890.70', change: '+420.15', changePercent: '+0.53%', isUp: true },
    { name: 'INDIA VIX', value: '13.42', change: '-0.65', changePercent: '-4.62%', isUp: false },
  ];

  return (
    <div style={{
      background: '#0f172a',
      border: '1px solid #1e293b',
      borderRadius: '0.5rem',
      padding: '0.75rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      gap: '1.5rem',
      overflowX: 'auto',
    }}>
      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        MARKET TICKER
      </span>

      <div style={{ display: 'flex', gap: '2rem', flex: 1, alignItems: 'center' }}>
        {indices.map((idx, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
            <span style={{ fontWeight: 600, color: '#cbd5e1' }}>{idx.name}</span>
            <span style={{ fontWeight: 700, color: '#f8fafc' }}>{idx.value}</span>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: idx.isUp ? '#4ade80' : '#f87171',
              backgroundColor: idx.isUp ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)',
              padding: '0.15rem 0.4rem',
              borderRadius: '0.25rem',
            }}>
              {idx.change} ({idx.changePercent})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
