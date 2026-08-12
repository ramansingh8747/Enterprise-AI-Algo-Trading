import React, { useEffect } from 'react';
import { TradingJournalEntry } from '@/types/tradingJournal';

interface JournalTradeDetailProps {
  entry: TradingJournalEntry | null;
  onClose: () => void;
  onNavigate?: (route: string) => void;
}

export const JournalTradeDetail: React.FC<JournalTradeDetailProps> = ({
  entry,
  onClose,
  onNavigate,
}) => {
  // Keydown Escape listener
  useEffect(() => {
    if (!entry) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [entry, onClose]);

  if (!entry) return null;

  const isWin = entry.result === 'WIN';
  const isLoss = entry.result === 'LOSS';
  const pnlColor = isWin ? '#4ade80' : isLoss ? '#f87171' : '#94a3b8';

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="journal-trade-title"
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
              <h2 id="journal-trade-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                {entry.symbol}
              </h2>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                color: entry.side === 'BUY' ? '#4ade80' : '#f87171',
                background: entry.side === 'BUY' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                padding: '0.1rem 0.4rem',
                borderRadius: '0.2rem',
              }}>
                PAPER {entry.side}
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Journal Entry: {entry.id}
            </span>
          </div>

          <button
            onClick={onClose}
            aria-label="Close journal trade detail panel"
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.3rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* P&L Performance Banner */}
        <div style={{
          background: isWin ? 'rgba(34, 197, 94, 0.1)' : isLoss ? 'rgba(239, 68, 68, 0.1)' : 'rgba(148, 163, 184, 0.1)',
          border: `1px solid ${isWin ? 'rgba(34, 197, 94, 0.25)' : isLoss ? 'rgba(239, 68, 68, 0.25)' : 'rgba(148, 163, 184, 0.25)'}`,
          borderRadius: '0.5rem',
          padding: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Realized P&L</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: pnlColor }}>
              {entry.realizedPnl >= 0 ? '+' : ''}₹{entry.realizedPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: pnlColor }}>
            {entry.realizedPnlPercent >= 0 ? '+' : ''}{entry.realizedPnlPercent.toFixed(2)}%
          </span>
        </div>

        {/* Details Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', fontSize: '0.85rem' }}>
          <div style={{ background: '#1e293b', padding: '0.75rem 0.9rem', borderRadius: '0.5rem' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block' }}>Quantity</span>
            <strong style={{ color: '#f8fafc', fontSize: '1rem' }}>{entry.quantity} shares</strong>
          </div>

          <div style={{ background: '#1e293b', padding: '0.75rem 0.9rem', borderRadius: '0.5rem' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block' }}>Entry Price</span>
            <strong style={{ color: '#f8fafc', fontSize: '1rem' }}>₹{entry.entryPrice.toFixed(2)}</strong>
          </div>

          <div style={{ background: '#1e293b', padding: '0.75rem 0.9rem', borderRadius: '0.5rem' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block' }}>Exit Price</span>
            <strong style={{ color: '#38bdf8', fontSize: '1rem' }}>
              {entry.exitPrice ? `₹${entry.exitPrice.toFixed(2)}` : 'OPEN'}
            </strong>
          </div>

          <div style={{ background: '#1e293b', padding: '0.75rem 0.9rem', borderRadius: '0.5rem' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block' }}>Strategy</span>
            <strong style={{ color: '#a78bfa', fontSize: '1rem' }}>{entry.strategy || 'Standard'}</strong>
          </div>
        </div>

        {/* Navigation Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button
            onClick={() => { onClose(); onNavigate?.('/orders'); }}
            style={{ flex: 1, padding: '0.65rem', borderRadius: '0.5rem', background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
          >
            View Orders
          </button>
          <button
            onClick={() => { onClose(); onNavigate?.('/portfolio'); }}
            style={{ flex: 1, padding: '0.65rem', borderRadius: '0.5rem', background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
          >
            View Portfolio
          </button>
          <button
            onClick={() => { onClose(); onNavigate?.('/strategy'); }}
            style={{ flex: 1, padding: '0.65rem', borderRadius: '0.5rem', background: '#0284c7', border: 'none', color: '#ffffff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
          >
            View Strategy
          </button>
        </div>
      </div>
    </div>
  );
};
