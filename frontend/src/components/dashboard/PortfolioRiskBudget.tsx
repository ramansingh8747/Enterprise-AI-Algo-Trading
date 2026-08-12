import React from 'react';
import { MonitoredPosition } from '@/types/positionMonitor';
import { RiskIntelligenceSummary } from '@/types/riskPositionIntelligence';

interface PortfolioRiskBudgetProps {
  summary: RiskIntelligenceSummary;
  positions: MonitoredPosition[];
  paperBalance: number;
}

export const PortfolioRiskBudget: React.FC<PortfolioRiskBudgetProps> = ({
  summary,
  positions,
  paperBalance: _paperBalance,
}) => {
  const exposurePct = summary.exposurePercent;

  const longPositions = positions.filter(p => p.side === 'LONG');
  const shortPositions = positions.filter(p => p.side === 'SHORT');

  const longExp = longPositions.reduce((sum, p) => sum + p.currentValue, 0);
  const shortExp = shortPositions.reduce((sum, p) => sum + p.currentValue, 0);

  const budgetStatus = exposurePct > 80 ? 'CRITICAL EXPOSURE' : exposurePct > 50 ? 'MODERATE UTILIZATION' : 'SAFE BUDGET';
  const statusColor = exposurePct > 80 ? '#f87171' : exposurePct > 50 ? '#fbbf24' : '#4ade80';

  return (
    <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
          Portfolio Risk Budget & Exposure Concentration Intelligence
        </h3>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          Overall risk budget utilization, long/short exposure breakdown and top risk contributors
        </span>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Risk Budget Posture</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: statusColor }}>
            {budgetStatus}
          </p>
        </div>

        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Total Exposure</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8' }}>
            ₹{summary.totalExposure.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({exposurePct.toFixed(1)}%)
          </p>
        </div>

        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Long vs Short Ratio</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: '#cbd5e1' }}>
            <span style={{ color: '#4ade80' }}>₹{longExp.toLocaleString('en-IN', { maximumFractionDigits: 0 })} L</span> / <span style={{ color: '#f87171' }}>₹{shortExp.toLocaleString('en-IN', { maximumFractionDigits: 0 })} S</span>
          </p>
        </div>
      </div>

      {/* Visual Risk Budget Progress Bar */}
      <div style={{ background: '#1e293b', borderRadius: '0.5rem', padding: '0.85rem 1rem', border: '1px solid #334155' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
          <span>PORTFOLIO EXPOSURE BUDGET</span>
          <span style={{ color: statusColor, fontWeight: 700 }}>{exposurePct.toFixed(1)}% / 100%</span>
        </div>
        <div style={{ height: '0.65rem', background: '#0f172a', borderRadius: '9999px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(exposurePct, 100)}%`, background: statusColor, transition: 'width 0.3s' }} />
        </div>
      </div>
    </div>
  );
};
