import React from 'react';
import { RiskIntelligenceSummary } from '@/types/riskPositionIntelligence';

interface RiskHealthOverviewProps {
  summary: RiskIntelligenceSummary;
  paperBalance: number;
}

export const RiskHealthOverview: React.FC<RiskHealthOverviewProps> = ({ summary, paperBalance }) => {
  const statusColor = summary.healthStatus === 'LOW'
    ? '#4ade80'
    : summary.healthStatus === 'MODERATE'
    ? '#38bdf8'
    : summary.healthStatus === 'HIGH'
    ? '#fbbf24'
    : '#f87171';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem' }}>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Risk Health Score</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.35rem' }}>
          <span style={{ fontSize: '1.75rem', fontWeight: 900, color: statusColor }}>{summary.healthScore}</span>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: statusColor, textTransform: 'uppercase' }}>
            {summary.healthStatus} RISK
          </span>
        </div>
      </div>

      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem' }}>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Total Exposure</span>
        <p style={{ margin: '0.35rem 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8' }}>
          ₹{summary.totalExposure.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </p>
      </div>

      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem' }}>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Available Capital</span>
        <p style={{ margin: '0.35rem 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc' }}>
          ₹{paperBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </p>
      </div>

      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem' }}>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Risk Status Breakdown</span>
        <p style={{ margin: '0.35rem 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: '#cbd5e1' }}>
          <span style={{ color: '#4ade80' }}>{summary.safeCount} Safe</span> / <span style={{ color: '#fbbf24' }}>{summary.warningCount} Warn</span> / <span style={{ color: '#f87171' }}>{summary.dangerCount} Danger</span>
        </p>
      </div>
    </div>
  );
};
