import React, { useEffect } from 'react';
import { PaperHolding } from '@/types/paperPortfolio';

interface PositionDetailPanelProps {
  holding: PaperHolding | null;
  onClose: () => void;
  onTrade: (symbol: string, side: 'BUY' | 'SELL', price: number) => void;
  onViewStrategy?: (symbol: string) => void;
}

export const PositionDetailPanel: React.FC<PositionDetailPanelProps> = ({
  holding,
  onClose,
  onTrade,
  onViewStrategy: _onViewStrategy,
}) => {
  // Keydown Escape listener
  useEffect(() => {
    if (!holding) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [holding, onClose]);

  if (!holding) return null;

  const isPositive = holding.pnl >= 0;
  const pnlColor = isPositive ? '#4ade80' : '#f87171';

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="position-detail-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(2, 6, 23, 0.78)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '520px',
          background: '#0f172a',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '0.85rem',
          padding: '1.5rem',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.75)',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 id="position-detail-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                {holding.symbol}
              </h2>
              <span style={{ fontSize: '0.7rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', padding: '0.1rem 0.4rem', borderRadius: '0.2rem', fontWeight: 700 }}>
                PAPER POSITION
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Holding Details & Risk Metrics
            </span>
          </div>

          <button
            onClick={onClose}
            aria-label="Close position detail panel"
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.3rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* P&L Banner */}
        <div style={{
          background: isPositive ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${isPositive ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
          borderRadius: '0.5rem',
          padding: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Unrealized P&L</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: pnlColor }}>
              {isPositive ? '+' : ''}₹{holding.pnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: pnlColor }}>
            {isPositive ? '+' : ''}{holding.pnlPercent.toFixed(2)}%
          </span>
        </div>

        {/* Position Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', fontSize: '0.85rem' }}>
          <div style={{ background: '#1e293b', padding: '0.75rem 0.9rem', borderRadius: '0.5rem' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block' }}>Quantity</span>
            <strong style={{ color: '#f8fafc', fontSize: '1rem' }}>{holding.quantity} shares</strong>
          </div>

          <div style={{ background: '#1e293b', padding: '0.75rem 0.9rem', borderRadius: '0.5rem' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block' }}>Average Price</span>
            <strong style={{ color: '#f8fafc', fontSize: '1rem' }}>₹{holding.averagePrice.toFixed(2)}</strong>
          </div>

          <div style={{ background: '#1e293b', padding: '0.75rem 0.9rem', borderRadius: '0.5rem' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block' }}>Current Price</span>
            <strong style={{ color: '#38bdf8', fontSize: '1rem' }}>₹{holding.currentPrice.toFixed(2)}</strong>
          </div>

          <div style={{ background: '#1e293b', padding: '0.75rem 0.9rem', borderRadius: '0.5rem' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block' }}>Current Value</span>
            <strong style={{ color: '#f8fafc', fontSize: '1rem' }}>
              ₹{holding.currentValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </strong>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button
            onClick={() => { onClose(); onTrade(holding.symbol, 'BUY', holding.currentPrice); }}
            style={{
              flex: 1,
              padding: '0.75rem',
              borderRadius: '0.5rem',
              background: '#059669',
              border: 'none',
              color: '#ffffff',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Add More (Paper BUY)
          </button>
          <button
            onClick={() => { onClose(); onTrade(holding.symbol, 'SELL', holding.currentPrice); }}
            style={{
              flex: 1,
              padding: '0.75rem',
              borderRadius: '0.5rem',
              background: '#dc2626',
              border: 'none',
              color: '#ffffff',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Exit (Paper SELL)
          </button>
        </div>
      </div>
    </div>
  );
};
