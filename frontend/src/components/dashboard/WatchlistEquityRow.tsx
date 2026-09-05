import React from 'react';
import { Equity } from '@/types/market';
import { TradingSignal } from '@/types/signal';
import { getMarketSessionStatus } from '@/utils/marketTiming';

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
      background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.45) 100%)',
      border: '1px solid rgba(148, 163, 184, 0.12)',
      borderRadius: '0.75rem',
      padding: '0.95rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '1rem',
      flexWrap: 'wrap',
      backdropFilter: 'blur(6px)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.18)',
      transition: 'all 0.18s ease',
    }}>
      {/* Symbol & Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: '190px' }}>
        <button
          onClick={() => onToggleWatchlist(equity)}
          style={{
            background: 'transparent',
            border: 'none',
            color: isInWatchlist ? '#fbbf24' : '#64748b',
            fontSize: '1.2rem',
            cursor: 'pointer',
            padding: 0,
            transition: 'transform 0.15s ease',
          }}
          title={isInWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
        >
          {isInWatchlist ? '★' : '☆'}
        </button>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <strong style={{ fontSize: '0.98rem', color: '#f8fafc', fontWeight: 900, letterSpacing: '-0.01em' }}>
              {equity.symbol}
            </strong>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', background: '#1e293b', padding: '0.1rem 0.4rem', borderRadius: '0.25rem' }}>
              {equity.exchange || 'NSE'}
            </span>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginTop: '0.1rem' }}>
            {equity.name}
          </span>
        </div>
      </div>

      {/* Price & Change */}
      <div style={{ textAlign: 'right', minWidth: '130px' }}>
        <strong style={{ fontSize: '1.05rem', color: '#f8fafc', display: 'block', fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
          ₹{equity.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </strong>
        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: priceColor, fontVariantNumeric: 'tabular-nums' }}>
          {isPositive ? '+' : ''}{equity.change.toFixed(2)} ({isPositive ? '+' : ''}{equity.changePercent.toFixed(2)}%)
        </span>
      </div>

      {/* Signal Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{
          fontSize: '0.72rem',
          fontWeight: 800,
          color: signalColor,
          background: signalBg,
          border: `1px solid ${signalColor}35`,
          padding: '0.25rem 0.7rem',
          borderRadius: '0.375rem',
          letterSpacing: '0.02em',
        }}>
          {signalAction} ({signalTrend})
        </span>
      </div>

      {/* Action Buttons with Market Hours Validation */}
      {(() => {
        const session = getMarketSessionStatus();
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => onTrade(equity, 'BUY')}
              title={!session.isOpen ? 'Market is currently closed (09:15 - 15:15 IST)' : 'Paper BUY'}
              style={{
                padding: '0.42rem 0.9rem',
                background: session.isOpen
                  ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.25) 0%, rgba(22, 163, 74, 0.35) 100%)'
                  : 'rgba(34, 197, 94, 0.12)',
                border: session.isOpen ? '1px solid rgba(74, 222, 128, 0.4)' : '1px solid rgba(74, 222, 128, 0.2)',
                borderRadius: '0.45rem',
                color: session.isOpen ? '#4ade80' : '#86efac',
                fontWeight: 800,
                fontSize: '0.75rem',
                cursor: session.isOpen ? 'pointer' : 'not-allowed',
                opacity: session.isOpen ? 1 : 0.75,
                transition: 'all 0.15s ease',
              }}
            >
              Paper BUY
            </button>
            <button
              onClick={() => onTrade(equity, 'SELL')}
              title={!session.canExit ? 'Market is currently closed' : 'Paper SELL'}
              style={{
                padding: '0.42rem 0.9rem',
                background: session.canExit
                  ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(220, 38, 38, 0.35) 100%)'
                  : 'rgba(239, 68, 68, 0.12)',
                border: session.canExit ? '1px solid rgba(248, 113, 113, 0.4)' : '1px solid rgba(248, 113, 113, 0.2)',
                borderRadius: '0.45rem',
                color: session.canExit ? '#f87171' : '#fca5a5',
                fontWeight: 800,
                fontSize: '0.75rem',
                cursor: session.canExit ? 'pointer' : 'not-allowed',
                opacity: session.canExit ? 1 : 0.75,
                transition: 'all 0.15s ease',
              }}
            >
              Paper SELL
            </button>
          </div>
        );
      })()}
    </div>
  );
};
