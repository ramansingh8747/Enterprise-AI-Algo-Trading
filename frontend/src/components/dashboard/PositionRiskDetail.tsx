import React, { useEffect } from 'react';
import { MonitoredPosition } from '@/types/positionMonitor';

interface PositionRiskDetailProps {
  position: MonitoredPosition | null;
  onClose: () => void;
  onNavigate?: (route: string) => void;
}

export const PositionRiskDetail: React.FC<PositionRiskDetailProps> = ({
  position,
  onClose,
  onNavigate,
}) => {
  // Keydown Escape listener
  useEffect(() => {
    if (!position) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [position, onClose]);

  if (!position) return null;

  const isSafe = position.riskStatus === 'SAFE';
  const isWarning = position.riskStatus === 'WARNING';
  const riskColor = isSafe ? '#4ade80' : isWarning ? '#fbbf24' : '#f87171';

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="position-risk-title"
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
          maxWidth: '540px',
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
              <h2 id="position-risk-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                {position.symbol}
              </h2>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                color: riskColor,
                background: `${riskColor}22`,
                padding: '0.1rem 0.45rem',
                borderRadius: '0.25rem',
              }}>
                {position.riskStatus} RISK
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Position Risk & Exposure Breakdown
            </span>
          </div>

          <button
            onClick={onClose}
            aria-label="Close position risk detail panel"
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.3rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Position Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', fontSize: '0.85rem' }}>
          <div style={{ background: '#1e293b', padding: '0.75rem 0.9rem', borderRadius: '0.5rem' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block' }}>Quantity</span>
            <strong style={{ color: '#f8fafc', fontSize: '1rem' }}>{position.quantity} shares</strong>
          </div>

          <div style={{ background: '#1e293b', padding: '0.75rem 0.9rem', borderRadius: '0.5rem' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block' }}>Average Price</span>
            <strong style={{ color: '#f8fafc', fontSize: '1rem' }}>₹{position.averagePrice.toFixed(2)}</strong>
          </div>

          <div style={{ background: '#1e293b', padding: '0.75rem 0.9rem', borderRadius: '0.5rem' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block' }}>Current Price</span>
            <strong style={{ color: '#38bdf8', fontSize: '1rem' }}>₹{position.currentPrice.toFixed(2)}</strong>
          </div>

          <div style={{ background: '#1e293b', padding: '0.75rem 0.9rem', borderRadius: '0.5rem' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block' }}>Portfolio Exposure</span>
            <strong style={{ color: '#fbbf24', fontSize: '1rem' }}>{position.exposurePercent.toFixed(1)}%</strong>
          </div>
        </div>

        {/* P&L Performance Banner */}
        <div style={{
          background: position.pnl >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${position.pnl >= 0 ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
          borderRadius: '0.5rem',
          padding: '0.85rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Unrealized P&L</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: position.pnl >= 0 ? '#4ade80' : '#f87171' }}>
              {position.pnl >= 0 ? '+' : ''}₹{position.pnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <span style={{ fontSize: '1rem', fontWeight: 800, color: position.pnl >= 0 ? '#4ade80' : '#f87171' }}>
            {position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%
          </span>
        </div>

        {/* Navigation Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <button
            onClick={() => { onClose(); onNavigate?.('/portfolio'); }}
            style={{ padding: '0.65rem', borderRadius: '0.5rem', background: '#0284c7', border: 'none', color: '#ffffff', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}
          >
            View Portfolio
          </button>
          <button
            onClick={() => { onClose(); onNavigate?.('/orders'); }}
            style={{ padding: '0.65rem', borderRadius: '0.5rem', background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
          >
            View Orders
          </button>
          <button
            onClick={() => { onClose(); onNavigate?.('/strategy'); }}
            style={{ padding: '0.65rem', borderRadius: '0.5rem', background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
          >
            View Strategy
          </button>
          <button
            onClick={() => { onClose(); onNavigate?.('/journal'); }}
            style={{ padding: '0.65rem', borderRadius: '0.5rem', background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
          >
            View Journal
          </button>
        </div>
      </div>
    </div>
  );
};
