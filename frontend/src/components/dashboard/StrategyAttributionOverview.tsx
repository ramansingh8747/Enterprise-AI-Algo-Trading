import React from 'react';
import { TradingSignal } from '@/types/signal';

interface StrategyAttributionOverviewProps {
  signals: TradingSignal[];
}

export const StrategyAttributionOverview: React.FC<StrategyAttributionOverviewProps> = ({ signals }) => {
  const momentumBreakoutSignals = signals.filter(s => s.strategy === 'Momentum Breakout');
  const momentumReversalSignals = signals.filter(s => s.strategy === 'Momentum Reversal');
  const trendWatchSignals = signals.filter(s => s.strategy === 'Trend Watch');

  const strategies = [
    {
      name: 'Momentum Breakout',
      count: momentumBreakoutSignals.length,
      buyCount: momentumBreakoutSignals.filter(s => s.action === 'BUY').length,
      sellCount: momentumBreakoutSignals.filter(s => s.action === 'SELL').length,
      avgStrength: momentumBreakoutSignals.length > 0 ? momentumBreakoutSignals.reduce((sum, s) => sum + s.strength, 0) / momentumBreakoutSignals.length : 0,
      riskLevel: 'LOW',
      riskColor: '#4ade80',
    },
    {
      name: 'Momentum Reversal',
      count: momentumReversalSignals.length,
      buyCount: momentumReversalSignals.filter(s => s.action === 'BUY').length,
      sellCount: momentumReversalSignals.filter(s => s.action === 'SELL').length,
      avgStrength: momentumReversalSignals.length > 0 ? momentumReversalSignals.reduce((sum, s) => sum + s.strength, 0) / momentumReversalSignals.length : 0,
      riskLevel: 'MODERATE',
      riskColor: '#fbbf24',
    },
    {
      name: 'Trend Watch',
      count: trendWatchSignals.length,
      buyCount: trendWatchSignals.filter(s => s.action === 'BUY').length,
      sellCount: trendWatchSignals.filter(s => s.action === 'SELL').length,
      avgStrength: trendWatchSignals.length > 0 ? trendWatchSignals.reduce((sum, s) => sum + s.strength, 0) / trendWatchSignals.length : 0,
      riskLevel: 'SAFE',
      riskColor: '#38bdf8',
    },
  ];

  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
          Strategy Performance Attribution & Risk Breakdown
        </h3>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          Per-strategy signal generation, direction bias and risk ratings
        </span>
      </div>

      {/* Per-Strategy Attribution Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {strategies.map((strat, idx) => (
          <div key={idx} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.65rem', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <strong style={{ fontSize: '0.95rem', color: '#f8fafc' }}>{strat.name}</strong>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: strat.riskColor, background: `${strat.riskColor}18`, border: `1px solid ${strat.riskColor}40`, padding: '0.1rem 0.4rem', borderRadius: '0.2rem' }}>
                {strat.riskLevel}
              </span>
            </div>

            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#38bdf8' }}>
              {strat.count} Signals
            </div>

            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
              <span style={{ color: '#4ade80', fontWeight: 700 }}>{strat.buyCount} BUY</span> / <span style={{ color: '#f87171', fontWeight: 700 }}>{strat.sellCount} SELL</span>
            </div>

            <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '0.5rem' }}>
              Avg Strength: <strong>{strat.avgStrength.toFixed(1)}%</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
