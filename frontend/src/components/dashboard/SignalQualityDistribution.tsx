import React from 'react';
import { TradingSignal } from '@/types/signal';

interface SignalQualityDistributionProps {
  signals: TradingSignal[];
}

export const SignalQualityDistribution: React.FC<SignalQualityDistributionProps> = ({ signals }) => {
  const total = signals.length;

  const strongCount = signals.filter(s => s.strength >= 75).length;
  const moderateCount = signals.filter(s => s.strength >= 50 && s.strength < 75).length;
  const weakCount = signals.filter(s => s.strength < 50).length;

  const strongPct = total > 0 ? (strongCount / total) * 100 : 0;
  const moderatePct = total > 0 ? (moderateCount / total) * 100 : 0;
  const weakPct = total > 0 ? (weakCount / total) * 100 : 0;

  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
          Signal Quality & Decision Distribution
        </h3>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          Signal tier breakdown based on model strength thresholds
        </span>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Strong Signals</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: '#4ade80' }}>
            {strongCount} ({strongPct.toFixed(0)}%)
          </p>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Moderate Signals</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: '#fbbf24' }}>
            {moderateCount} ({moderatePct.toFixed(0)}%)
          </p>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Weak Signals</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: '#f87171' }}>
            {weakCount} ({weakPct.toFixed(0)}%)
          </p>
        </div>
      </div>

      {/* Visual Quality Distribution Bar */}
      <div style={{ background: '#0f172a', borderRadius: '0.5rem', padding: '0.85rem 1rem', border: '1px solid #334155' }}>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '0.5rem' }}>
          SIGNAL QUALITY TIER BREAKDOWN
        </span>
        <div style={{ display: 'flex', height: '0.75rem', borderRadius: '0.375rem', overflow: 'hidden', background: '#1e293b' }}>
          <div style={{ width: `${strongPct}%`, background: '#4ade80', transition: 'width 0.3s' }} title={`Strong: ${strongPct.toFixed(1)}%`} />
          <div style={{ width: `${moderatePct}%`, background: '#fbbf24', transition: 'width 0.3s' }} title={`Moderate: ${moderatePct.toFixed(1)}%`} />
          <div style={{ width: `${weakPct}%`, background: '#f87171', transition: 'width 0.3s' }} title={`Weak: ${weakPct.toFixed(1)}%`} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.5rem' }}>
          <span style={{ color: '#4ade80' }}>● Strong (≥75%)</span>
          <span style={{ color: '#fbbf24' }}>● Moderate (50-74%)</span>
          <span style={{ color: '#f87171' }}>● Weak (&lt;50%)</span>
        </div>
      </div>
    </div>
  );
};
