import React, { useState } from 'react';
import { MonitoredPosition } from '@/types/positionMonitor';
import { RiskTimeRange } from '@/types/riskPositionIntelligence';
import { calculateAdvancedRiskAnalytics } from '@/services/paperTrading/riskPositionIntelligenceService';

interface AdvancedRiskAnalyticsProps {
  positions: MonitoredPosition[];
  paperBalance: number;
  portfolioValue: number;
}

export const AdvancedRiskAnalytics: React.FC<AdvancedRiskAnalyticsProps> = ({
  positions,
  paperBalance,
  portfolioValue,
}) => {
  const [timeRange, setTimeRange] = useState<RiskTimeRange>('ALL');

  const analytics = calculateAdvancedRiskAnalytics(positions, paperBalance, portfolioValue);

  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem', color: '#f8fafc' }}>
      {/* Header & Range Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
          Historical & Portfolio Risk Distribution Analytics
        </h3>

        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          {(['TODAY', '7D', '30D', 'ALL'] as RiskTimeRange[]).map(r => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              style={{
                padding: '0.3rem 0.6rem',
                borderRadius: '0.25rem',
                fontWeight: 700,
                fontSize: '0.75rem',
                cursor: 'pointer',
                background: timeRange === r ? '#0284c7' : '#0f172a',
                border: '1px solid #334155',
                color: timeRange === r ? '#ffffff' : '#94a3b8',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Analytics KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Long vs Short Count</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>
            <span style={{ color: '#4ade80' }}>{analytics.longCount} Long</span> / <span style={{ color: '#f87171' }}>{analytics.shortCount} Short</span>
          </p>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Long Exposure</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: '#4ade80' }}>
            ₹{analytics.longExposure.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Short Exposure</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: '#f87171' }}>
            ₹{analytics.shortExposure.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Risk Distribution</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1rem', fontWeight: 800, color: '#cbd5e1' }}>
            <span style={{ color: '#4ade80' }}>{analytics.safePercent.toFixed(0)}% Safe</span> | <span style={{ color: '#f87171' }}>{analytics.dangerPercent.toFixed(0)}% Danger</span>
          </p>
        </div>
      </div>

      {/* Visual Risk Distribution Bar */}
      <div style={{ background: '#0f172a', borderRadius: '0.5rem', padding: '0.85rem 1rem', border: '1px solid #334155' }}>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '0.5rem' }}>
          RISK SEVERITY DISTRIBUTION
        </span>
        <div style={{ display: 'flex', height: '0.75rem', borderRadius: '0.375rem', overflow: 'hidden', background: '#1e293b' }}>
          <div style={{ width: `${analytics.safePercent}%`, background: '#4ade80', transition: 'width 0.3s' }} title={`Safe: ${analytics.safePercent.toFixed(1)}%`} />
          <div style={{ width: `${analytics.warningPercent}%`, background: '#fbbf24', transition: 'width 0.3s' }} title={`Warning: ${analytics.warningPercent.toFixed(1)}%`} />
          <div style={{ width: `${analytics.dangerPercent}%`, background: '#f87171', transition: 'width 0.3s' }} title={`Danger: ${analytics.dangerPercent.toFixed(1)}%`} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.5rem' }}>
          <span style={{ color: '#4ade80' }}>● Safe ({analytics.safePercent.toFixed(0)}%)</span>
          <span style={{ color: '#fbbf24' }}>● Warning ({analytics.warningPercent.toFixed(0)}%)</span>
          <span style={{ color: '#f87171' }}>● Danger ({analytics.dangerPercent.toFixed(0)}%)</span>
        </div>
      </div>
    </div>
  );
};
