import React, { useState } from 'react';
import { Equity } from '@/types/market';
import { initialEquities } from '@/data/marketData';

interface EquityListProps {
  equities?: Equity[];
  watchlistSymbols?: string[];
  onAddToWatchlist?: (equity: Equity) => void;
  onTrade?: (equity: Equity, side: "BUY" | "SELL") => void;
}

export const EquityList: React.FC<EquityListProps> = ({
  equities = initialEquities,
  watchlistSymbols = [],
  onAddToWatchlist,
  onTrade,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEquities = equities.filter(
    (e) =>
      e.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{
      background: '#1e293b',
      borderRadius: '0.75rem',
      border: '1px solid #334155',
      padding: '1.25rem',
      color: '#f8fafc',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.125rem', color: '#38bdf8' }}>Equity Market</h3>
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>NSE Listed Equities</span>
      </div>

      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search symbols (e.g. RELIANCE, TCS, SBIN)..."
        style={{
          width: '100%',
          padding: '0.65rem 0.85rem',
          borderRadius: '0.5rem',
          border: '1px solid #334155',
          background: '#0f172a',
          color: '#ffffff',
          marginBottom: '1rem',
          outline: 'none',
          boxSizing: 'border-box',
          fontSize: '0.875rem',
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '440px', overflowY: 'auto' }}>
        {filteredEquities.map((eq) => {
          const isAdded = watchlistSymbols.includes(eq.symbol);
          const isUp = eq.change >= 0;

          return (
            <div
              key={eq.symbol}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 1rem',
                background: '#0f172a',
                borderRadius: '0.5rem',
                border: '1px solid #1e293b',
                gap: '0.75rem',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: 1, minWidth: '140px' }}>
                <span style={{ fontWeight: 700, color: '#f1f5f9', display: 'block', fontSize: '0.95rem' }}>
                  {eq.symbol}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{eq.name} ({eq.exchange})</span>
              </div>

              <div style={{ textAlign: 'right', minWidth: '100px' }}>
                <span style={{ fontWeight: 700, color: '#f8fafc', display: 'block', fontSize: '0.95rem' }}>
                  ₹{eq.price.toFixed(2)}
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: isUp ? '#4ade80' : '#f87171',
                }}>
                  {isUp ? '+' : ''}{eq.change.toFixed(2)} ({isUp ? '+' : ''}{eq.changePercent.toFixed(2)}%)
                </span>
              </div>

              {/* Action Buttons: BUY, SELL, ADD */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button
                  onClick={() => onTrade?.(eq, 'BUY')}
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    background: '#16a34a',
                    color: '#ffffff',
                  }}
                >
                  BUY
                </button>

                <button
                  onClick={() => onTrade?.(eq, 'SELL')}
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    background: '#dc2626',
                    color: '#ffffff',
                  }}
                >
                  SELL
                </button>

                <button
                  onClick={() => onAddToWatchlist?.(eq)}
                  disabled={isAdded}
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: isAdded ? 'default' : 'pointer',
                    background: isAdded ? '#334155' : '#0284c7',
                    color: isAdded ? '#94a3b8' : '#ffffff',
                    transition: 'all 0.2s',
                  }}
                >
                  {isAdded ? 'Added ✓' : '+ Add'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EquityList;
