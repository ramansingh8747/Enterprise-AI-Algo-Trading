import React from 'react';
import { TradingSignal } from '@/types/signal';

interface StrategyPerformanceOverviewProps {
  signals: TradingSignal[];
}

export const StrategyPerformanceOverview: React.FC<StrategyPerformanceOverviewProps> = ({ signals }) => {
  const total = signals.length;
  const buyCount = signals.filter(s => s.action === 'BUY').length;
  const sellCount = signals.filter(s => s.action === 'SELL').length;
  const holdCount = signals.filter(s => s.action === 'HOLD').length;

  const buyPct = total > 0 ? (buyCount / total) * 100 : 0;
  const sellPct = total > 0 ? (sellCount / total) * 100 : 0;
  const holdPct = total > 0 ? (holdCount / total) * 100 : 0;

  const avgStrength = total > 0 ? signals.reduce((sum, s) => sum + s.strength, 0) / total : 0;

  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
          Strategy Performance & Signal Intelligence
        </h3>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          Real-time signal distribution, direction breakdown and model signal strength
        </span>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Active Signals</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8' }}>
            {total} Signals
          </p>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Signal Direction</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>
            <span style={{ color: '#4ade80' }}>{buyCount} BUY</span> / <span style={{ color: '#f87171' }}>{sellCount} SELL</span>
          </p>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Avg Signal Strength</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: '#4ade80' }}>
            {avgStrength.toFixed(1)}%
          </p>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Execution Mode</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: '#fbbf24' }}>
            PAPER SIMULATION
          </p>
        </div>
      </div>

      {/* Visual Direction Distribution Bar */}
      <div style={{ background: '#0f172a', borderRadius: '0.5rem', padding: '0.85rem 1rem', border: '1px solid #334155' }}>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '0.5rem' }}>
          SIGNAL ACTION DISTRIBUTION
        </span>
        <div style={{ display: 'flex', height: '0.75rem', borderRadius: '0.375rem', overflow: 'hidden', background: '#1e293b' }}>
          <div style={{ width: `${buyPct}%`, background: '#4ade80', transition: 'width 0.3s' }} title={`BUY: ${buyPct.toFixed(1)}%`} />
          <div style={{ width: `${sellPct}%`, background: '#f87171', transition: 'width 0.3s' }} title={`SELL: ${sellPct.toFixed(1)}%`} />
          <div style={{ width: `${holdPct}%`, background: '#94a3b8', transition: 'width 0.3s' }} title={`HOLD: ${holdPct.toFixed(1)}%`} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.5rem' }}>
          <span style={{ color: '#4ade80' }}>● BUY ({buyCount})</span>
          <span style={{ color: '#f87171' }}>● SELL ({sellCount})</span>
          <span style={{ color: '#94a3b8' }}>● HOLD ({holdCount})</span>
        </div>
      </div>
    </div>
  );
};
