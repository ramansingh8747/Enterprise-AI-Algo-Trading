import React from 'react';

export interface WatchlistItem {
  symbol: string;
  price: number;
  change: number;
}

const defaultWatchlist: WatchlistItem[] = [
  { symbol: 'RELIANCE', price: 2000.0, change: 1.25 },
  { symbol: 'TCS', price: 3500.0, change: -0.45 },
  { symbol: 'INFY', price: 1650.0, change: 0.82 },
  { symbol: 'HDFCBANK', price: 1750.0, change: 1.1 },
  { symbol: 'ICICIBANK', price: 1210.0, change: -0.15 },
];

export const WatchlistWidget: React.FC = () => {
  return (
    <div style={{
      background: '#1e293b',
      borderRadius: '0.75rem',
      border: '1px solid #334155',
      padding: '1.25rem',
      color: '#f8fafc',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.125rem', color: '#38bdf8' }}>Watchlist</h3>
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>5 Symbols</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {defaultWatchlist.map((item, i) => {
          const isUp = item.change >= 0;
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 1rem',
                background: '#0f172a',
                borderRadius: '0.5rem',
                border: '1px solid #1e293b',
              }}
            >
              <div>
                <span style={{ fontWeight: 700, color: '#f1f5f9', display: 'block', fontSize: '0.95rem' }}>
                  {item.symbol}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>NSE EQ</span>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontWeight: 700, color: '#f8fafc', display: 'block', fontSize: '0.95rem' }}>
                  ₹{item.price.toFixed(2)}
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: isUp ? '#4ade80' : '#f87171',
                }}>
                  {isUp ? '+' : ''}{item.change.toFixed(2)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
