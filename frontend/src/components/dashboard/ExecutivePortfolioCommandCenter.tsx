import React from 'react';
import { PaperHolding } from '@/types/paperPortfolio';
import { PortfolioAnalyticsSummary } from '@/types/portfolioAnalytics';
import { RiskIntelligenceSummary } from '@/types/riskPositionIntelligence';

interface ExecutivePortfolioCommandCenterProps {
  paperBalance: number;
  portfolioValue: number;
  analytics: PortfolioAnalyticsSummary;
  riskSummary: RiskIntelligenceSummary;
  holdings: PaperHolding[];
  onNavigate?: (route: string) => void;
}

export const ExecutivePortfolioCommandCenter: React.FC<ExecutivePortfolioCommandCenterProps> = ({
  paperBalance,
  portfolioValue,
  analytics,
  riskSummary,
  holdings,
  onNavigate,
}) => {
  const totalEquity = paperBalance + portfolioValue;
  const totalPnl = analytics.unrealizedPnl;

  const topGainer = [...holdings].sort((a, b) => b.pnl - a.pnl)[0] || null;
  const topLoser = [...holdings].sort((a, b) => a.pnl - b.pnl)[0] || null;

  return (
    <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.85rem', padding: '1.5rem', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.2rem' }}>🏛️</span>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#f8fafc' }}>
              Executive Portfolio Decision Support Command Center
            </h2>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            High-level executive summary of portfolio posture, risk concentration, and performance drivers
          </span>
        </div>

        {/* Executive Quick Links */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => onNavigate?.('/strategy')}
            style={{ padding: '0.4rem 0.8rem', borderRadius: '0.375rem', background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
          >
            Strategy Intelligence
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('/orders')}
            style={{ padding: '0.4rem 0.8rem', borderRadius: '0.375rem', background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
          >
            Order Intelligence
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('/journal')}
            style={{ padding: '0.4rem 0.8rem', borderRadius: '0.375rem', background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
          >
            Trading Journal
          </button>
        </div>
      </div>

      {/* Decision Context & Attention Areas Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        {/* Decision Context Panel */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.65rem', padding: '1.1rem' }}>
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: 800, color: '#38bdf8' }}>
            Portfolio Decision Context
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #334155', paddingBottom: '0.35rem' }}>
              <span>Total Portfolio Equity:</span>
              <strong style={{ color: '#f8fafc' }}>₹{totalEquity.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #334155', paddingBottom: '0.35rem' }}>
              <span>Net Unrealized P&L:</span>
              <strong style={{ color: totalPnl >= 0 ? '#4ade80' : '#f87171' }}>
                {totalPnl >= 0 ? '+' : ''}₹{totalPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #334155', paddingBottom: '0.35rem' }}>
              <span>Portfolio Exposure Ratio:</span>
              <strong style={{ color: '#38bdf8' }}>{riskSummary.exposurePercent.toFixed(1)}%</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.35rem' }}>
              <span>Active Holdings Count:</span>
              <strong style={{ color: '#f8fafc' }}>{holdings.length} Positions</strong>
            </div>
          </div>
        </div>

        {/* Portfolio Observations & Attention Areas */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.65rem', padding: '1.1rem' }}>
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: 800, color: '#fbbf24' }}>
            Portfolio Attention Areas
          </h4>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.6 }}>
            <li>
              Top Gainer Position: {topGainer ? `${topGainer.symbol} (+₹${topGainer.pnl.toLocaleString('en-IN')})` : 'None'}
            </li>
            <li>
              Top Risk Exposure: {topLoser ? `${topLoser.symbol} (-₹${Math.abs(topLoser.pnl).toLocaleString('en-IN')})` : 'None'}
            </li>
            <li>
              Exposure Status: {riskSummary.exposurePercent > 80 ? 'Elevated portfolio margin utilization.' : 'Margin utilization is within normal parameters.'}
            </li>
            <li>
              All orders and execution flows remain in Paper Trading simulation mode.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
