import React from 'react';
import { PaperHolding } from '@/types/paperPortfolio';
import { PortfolioAnalyticsSummary } from '@/types/portfolioAnalytics';
import { RiskIntelligenceSummary } from '@/types/riskPositionIntelligence';

interface PortfolioHealthScorecardProps {
  paperBalance: number;
  portfolioValue: number;
  analytics: PortfolioAnalyticsSummary;
  riskSummary: RiskIntelligenceSummary;
  holdings: PaperHolding[];
  onNavigate?: (route: string) => void;
}

export const PortfolioHealthScorecard: React.FC<PortfolioHealthScorecardProps> = ({
  paperBalance,
  portfolioValue,
  analytics,
  riskSummary,
  holdings,
  onNavigate,
}) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _totalEquity = paperBalance + portfolioValue;
  const isPositivePnl = analytics.unrealizedPnl >= 0;

  const performanceStatus = isPositivePnl ? 'POSITIVE' : 'DRAWDOWN';
  const riskStatus = riskSummary.healthStatus === 'LOW' ? 'OPTIMAL' : 'MONITOR';
  const overallHealth = isPositivePnl && riskSummary.healthStatus === 'LOW' ? 'HEALTHY' : 'ATTENTION';

  const healthColor = overallHealth === 'HEALTHY' ? '#4ade80' : '#fbbf24';

  return (
    <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.85rem', padding: '1.5rem', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.2rem' }}>📊</span>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#f8fafc' }}>
              Portfolio Health Scorecard & Executive Intelligence
            </h2>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Comprehensive status scorecard across performance, risk health, drawdown, and allocation dimensions
          </span>
        </div>

        {/* Executive Overall Status Badge */}
        <div style={{ background: '#1e293b', border: `1px solid ${healthColor}`, borderRadius: '0.5rem', padding: '0.45rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>OVERALL HEALTH:</span>
          <strong style={{ color: healthColor, fontSize: '0.85rem' }}>{overallHealth}</strong>
        </div>
      </div>

      {/* Health Scorecard Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
        {/* Performance Dimension */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.65rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>PERFORMANCE HEALTH</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: isPositivePnl ? '#4ade80' : '#f87171' }}>
            {performanceStatus}
          </p>
          <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
            {isPositivePnl ? '+' : ''}₹{analytics.unrealizedPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>

        {/* Risk Dimension */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.65rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>RISK HEALTH</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: riskStatus === 'OPTIMAL' ? '#4ade80' : '#fbbf24' }}>
            {riskStatus}
          </p>
          <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
            {riskSummary.exposurePercent.toFixed(1)}% Exposure
          </span>
        </div>

        {/* Allocation Dimension */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.65rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>ALLOCATION HEALTH</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: '#38bdf8' }}>
            BALANCED
          </p>
          <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
            {holdings.length} Active Holdings
          </span>
        </div>

        {/* Execution Dimension */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.65rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>EXECUTION HEALTH</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: '#4ade80' }}>
            PAPER SIMULATED
          </p>
          <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
            100% Filled Rate
          </span>
        </div>
      </div>

      {/* Executive Attention & Navigation Bar */}
      <div style={{ background: '#1e293b', borderRadius: '0.5rem', padding: '0.85rem 1rem', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
          <strong style={{ color: '#fbbf24' }}>EXECUTIVE OBSERVATION: </strong>
          {overallHealth === 'HEALTHY' ? 'Portfolio metrics demonstrate stable capital allocation and safe risk parameters.' : 'Observation recommended for current unrealized drawdown and position margin buffers.'}
        </div>
        <button
          type="button"
          onClick={() => onNavigate?.('/journal')}
          style={{ padding: '0.35rem 0.75rem', borderRadius: '0.375rem', background: '#0284c7', border: 'none', color: '#ffffff', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
        >
          View Trading Journal →
        </button>
      </div>
    </div>
  );
};
