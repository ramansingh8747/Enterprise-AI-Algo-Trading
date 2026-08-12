import React from 'react';
import { PaperHolding } from '@/types/paperPortfolio';
import { PortfolioAnalyticsSummary } from '@/types/portfolioAnalytics';
import { RiskIntelligenceSummary } from '@/types/riskPositionIntelligence';

interface PortfolioMonitoringEarlyWarningProps {
  analytics: PortfolioAnalyticsSummary;
  riskSummary: RiskIntelligenceSummary;
  holdings: PaperHolding[];
}

export const PortfolioMonitoringEarlyWarning: React.FC<PortfolioMonitoringEarlyWarningProps> = ({
  analytics,
  riskSummary,
  holdings,
}) => {
  const isHighExposure = riskSummary.exposurePercent > 75;
  const isNegativePnl = analytics.unrealizedPnl < 0;
  const topLoser = [...holdings].sort((a, b) => a.pnl - b.pnl)[0] || null;

  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
          Portfolio Monitoring & Early Warning Intelligence
        </h3>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          Real-time observation of risk thresholds, drawdown conditions, and position concentration metrics
        </span>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Risk Health Alert Status</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: riskSummary.healthStatus === 'LOW' ? '#4ade80' : '#fbbf24' }}>
            {riskSummary.healthStatus} RISK
          </p>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Exposure Warning Level</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: isHighExposure ? '#fbbf24' : '#4ade80' }}>
            {isHighExposure ? 'ELEVATED EXPOSURE' : 'NORMAL EXPOSURE'}
          </p>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>P&L Trajectory</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: isNegativePnl ? '#f87171' : '#4ade80' }}>
            {isNegativePnl ? 'UNREALIZED DRAWDOWN' : 'POSITIVE ACCUMULATION'}
          </p>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Top Risk Position</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: '#f87171' }}>
            {topLoser && topLoser.pnl < 0 ? `${topLoser.symbol} (-₹${Math.abs(topLoser.pnl).toLocaleString('en-IN')})` : 'None'}
          </p>
        </div>
      </div>

      {/* Early Warning Observations */}
      <div style={{ background: '#0f172a', borderRadius: '0.5rem', padding: '0.85rem 1rem', border: '1px solid #334155' }}>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>
          EARLY WARNING OBSERVATIONS
        </span>
        <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.75rem', color: '#cbd5e1', lineHeight: 1.6 }}>
          <li>Monitoring active across {holdings.length} paper trading positions.</li>
          <li>{isHighExposure ? 'Capital utilization is above 75%. Monitor margin cushion.' : 'Capital utilization is well within safety thresholds.'}</li>
          <li>{isNegativePnl ? 'Current unrealized drawdown requires observation.' : 'Unrealized P&L is positive with stable position margins.'}</li>
        </ul>
      </div>
    </div>
  );
};
