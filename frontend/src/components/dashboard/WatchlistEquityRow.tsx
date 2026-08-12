import React from 'react';
import { Equity } from '@/types/market';
import { TradingSignal } from '@/types/signal';

interface WatchlistEquityRowProps {
  equity: Equity;
  signal?: TradingSignal;
  isInWatchlist: boolean;
  onToggleWatchlist: (equity: Equity) => void;
  onTrade: (equity: Equity, side: 'BUY' | 'SELL') => void;
  onViewStrategy?: (symbol: string) => void;
}

export const WatchlistEquityRow: React.FC<WatchlistEquityRowProps> = ({
  equity,
  signal,
  isInWatchlist,
  onToggleWatchlist,
  onTrade,
  onViewStrategy: _onViewStrategy,
}) => {
  const isPositive = equity.change >= 0;
  const priceColor = isPositive ? '#4ade80' : '#f87171';

  const signalAction = signal?.action || 'HOLD';
  const signalTrend = signal?.trend || 'NEUTRAL';

  const signalColor = signalAction === 'BUY' ? '#4ade80' : signalAction === 'SELL' ? '#f87171' : '#94a3b8';
  const signalBg = signalAction === 'BUY' ? 'rgba(74, 222, 128, 0.15)' : signalAction === 'SELL' ? 'rgba(248, 113, 113, 0.15)' : 'rgba(148, 163, 184, 0.15)';

  return (
    <div style={{
      background: '#0f172a',
      border: '1px solid rgba(148, 163, 184, 0.14)',
      borderRadius: '0.65rem',
      padding: '0.85rem 1.1rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '1rem',
      flexWrap: 'wrap',
      transition: 'all 0.15s ease',
    }}>
      {/* Symbol & Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: '180px' }}>
        <button
          onClick={() => onToggleWatchlist(equity)}
          style={{
            background: 'transparent',
            border: 'none',
            color: isInWatchlist ? '#fbbf24' : '#64748b',
            fontSize: '1.1rem',
            cursor: 'pointer',
            padding: 0,
          }}
          title={isInWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
        >
          {isInWatchlist ? '★' : '☆'}
        </button>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <strong style={{ fontSize: '0.95rem', color: '#f8fafc', fontWeight: 800 }}>{equity.symbol}</strong>
            <span style={{ fontSize: '0.65rem', color: '#64748b', background: '#1e293b', padding: '0.1rem 0.35rem', borderRadius: '0.2rem' }}>
              {equity.exchange || 'NSE'}
            </span>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginTop: '0.1rem' }}>
            {equity.name}
          </span>
        </div>
      </div>

      {/* Price & Change */}
      <div style={{ textAlign: 'right', minWidth: '120px' }}>
        <strong style={{ fontSize: '0.95rem', color: '#f8fafc', display: 'block' }}>
          ₹{equity.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </strong>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: priceColor }}>
          {isPositive ? '+' : ''}{equity.change.toFixed(2)} ({isPositive ? '+' : ''}{equity.changePercent.toFixed(2)}%)
        </span>
      </div>

      {/* Signal Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{
          fontSize: '0.7rem',
          fontWeight: 800,
          color: signalColor,
          background: signalBg,
          padding: '0.2rem 0.6rem',
          borderRadius: '0.25rem',
        }}>
          {signalAction} ({signalTrend})
        </span>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button
          onClick={() => onTrade(equity, 'BUY')}
          style={{
            padding: '0.35rem 0.75rem',
            background: 'rgba(34, 197, 94, 0.2)',
            border: '1px solid rgba(34, 197, 94, 0.35)',
            borderRadius: '0.375rem',
            color: '#4ade80',
            fontWeight: 800,
            fontSize: '0.75rem',
            cursor: 'pointer',
          }}
        >
          Paper BUY
        </button>
        <button
          onClick={() => onTrade(equity, 'SELL')}
          style={{
            padding: '0.35rem 0.75rem',
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '0.375rem',
            color: '#f87171',
            fontWeight: 800,
            fontSize: '0.75rem',
            cursor: 'pointer',
          }}
        >
          Paper SELL
        </button>
      </div>
    </div>
  );
};
