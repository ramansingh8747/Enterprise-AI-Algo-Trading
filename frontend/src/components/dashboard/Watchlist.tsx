import React from 'react';
import { WatchlistItem, Equity } from '@/types/market';
import { initialEquities } from '@/data/marketData';

interface WatchlistProps {
  items?: (WatchlistItem | Equity)[];
  onRemove?: (symbol: string) => void;
  onTrade?: (equity: Equity, side: "BUY" | "SELL") => void;
}

const defaultWatchlist: Equity[] = initialEquities.slice(0, 4);

export const Watchlist: React.FC<WatchlistProps> = ({
  items = defaultWatchlist,
  onRemove,
  onTrade,
}) => {
  return (
    <div style={{
      background: '#1e293b',
      borderRadius: '0.75rem',
      border: '1px solid #334155',
      padding: '1.25rem',
      color: '#f8fafc',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.125rem', color: '#38bdf8' }}>Watchlist ({items.length})</h3>
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Live Quotes</span>
      </div>

      {items.length === 0 ? (
        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>No symbols in watchlist. Search equities to add.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '440px', overflowY: 'auto' }}>
          {items.map((item) => {
            const isUp = item.change >= 0;
            return (
              <div
                key={item.symbol}
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
                <div style={{ flex: 1, minWidth: '130px' }}>
                  <span style={{ fontWeight: 700, color: '#f1f5f9', display: 'block', fontSize: '0.95rem' }}>
                    {item.symbol}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.name}</span>
                </div>

                <div style={{ textAlign: 'right', minWidth: '90px' }}>
                  <span style={{ fontWeight: 700, color: '#f8fafc', display: 'block', fontSize: '0.95rem' }}>
                    ₹{item.price.toFixed(2)}
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: isUp ? '#4ade80' : '#f87171',
                  }}>
                    {isUp ? '+' : ''}{item.change.toFixed(2)} ({isUp ? '+' : ''}{item.changePercent.toFixed(2)}%)
                  </span>
                </div>

                {/* Action Buttons: BUY, SELL, REMOVE */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <button
                    onClick={() => onTrade?.(item, 'BUY')}
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
                    onClick={() => onTrade?.(item, 'SELL')}
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

                  {onRemove && (
                    <button
                      onClick={() => onRemove(item.symbol)}
                      title="Remove from Watchlist"
                      style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '0.375rem',
                        color: '#fca5a5',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        padding: '0.35rem 0.5rem',
                        fontWeight: 700,
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Watchlist;
