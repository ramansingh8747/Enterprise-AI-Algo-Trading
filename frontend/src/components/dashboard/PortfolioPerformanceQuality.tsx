import React from 'react';
import { PaperHolding } from '@/types/paperPortfolio';
import { PortfolioAnalyticsSummary } from '@/types/portfolioAnalytics';

interface PortfolioPerformanceQualityProps {
  analytics: PortfolioAnalyticsSummary;
  holdings: PaperHolding[];
}

export const PortfolioPerformanceQuality: React.FC<PortfolioPerformanceQualityProps> = ({
  analytics,
  holdings,
}) => {
  const totalCount = analytics.winningCount + analytics.losingCount;
  const winRatePct = totalCount > 0 ? (analytics.winningCount / totalCount) * 100 : 0;

  const winningHoldings = holdings.filter(h => h.pnl > 0);
  const losingHoldings = holdings.filter(h => h.pnl < 0);

  const avgWinPnl = winningHoldings.length > 0 ? winningHoldings.reduce((sum, h) => sum + h.pnl, 0) / winningHoldings.length : 0;
  const avgLossPnl = losingHoldings.length > 0 ? Math.abs(losingHoldings.reduce((sum, h) => sum + h.pnl, 0)) / losingHoldings.length : 0;

  const winLossPnlRatio = avgLossPnl > 0 ? (avgWinPnl / avgLossPnl).toFixed(2) : avgWinPnl > 0 ? 'INF' : '0.00';

  const totalPnlAbs = Math.abs(analytics.unrealizedPnl);
  const topGainerPnl = [...holdings].sort((a, b) => b.pnl - a.pnl)[0]?.pnl || 0;
  const concentrationRatio = totalPnlAbs > 0 ? Math.min(100, Math.max(0, (topGainerPnl / totalPnlAbs) * 100)) : 0;

  const qualityStatus = winRatePct >= 60 ? 'HIGH CONSISTENCY' : winRatePct >= 40 ? 'MODERATE CONSISTENCY' : 'VARIABLE CONSISTENCY';
  const statusColor = winRatePct >= 60 ? '#4ade80' : winRatePct >= 40 ? '#fbbf24' : '#f87171';

  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
          Portfolio Performance Quality & Consistency Intelligence
        </h3>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          Performance stability, win/loss return ratios, and P&L concentration risk metrics
        </span>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Performance Posture</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: statusColor }}>
            {qualityStatus}
          </p>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Win Rate Stability</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: statusColor }}>
            {winRatePct.toFixed(1)}%
          </p>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Avg Win / Avg Loss Ratio</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: Number(winLossPnlRatio) >= 1.5 ? '#4ade80' : '#fbbf24' }}>
            {winLossPnlRatio}x
          </p>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Top P&L Concentration</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: concentrationRatio > 50 ? '#fbbf24' : '#38bdf8' }}>
            {concentrationRatio.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Neutral Consistency Observations */}
      <div style={{ background: '#0f172a', borderRadius: '0.5rem', padding: '0.85rem 1rem', border: '1px solid #334155' }}>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>
          CONSISTENCY OBSERVATIONS
        </span>
        <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.75rem', color: '#cbd5e1', lineHeight: 1.6 }}>
          <li>Performance is based on active paper trading positions and virtual margin calculations.</li>
          <li>{winningHoldings.length >= losingHoldings.length ? 'Winning positions outnumber losing positions in the current paper portfolio.' : 'Losing positions currently outnumber winning positions in paper trading.'}</li>
          <li>{concentrationRatio > 50 ? 'P&L contribution is concentrated in the top performing position.' : 'P&L contribution is distributed across multiple paper positions.'}</li>
        </ul>
      </div>
    </div>
  );
};
