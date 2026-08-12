import React from 'react';
import { PaperHolding } from '@/types/paperPortfolio';
import { PortfolioAnalyticsSummary } from '@/types/portfolioAnalytics';
import { RiskIntelligenceSummary } from '@/types/riskPositionIntelligence';

interface PortfolioCommandCenterUnifiedProps {
  paperBalance: number;
  portfolioValue: number;
  analytics: PortfolioAnalyticsSummary;
  riskSummary: RiskIntelligenceSummary;
  holdings: PaperHolding[];
  onNavigate?: (route: string) => void;
}

export const PortfolioCommandCenterUnified: React.FC<PortfolioCommandCenterUnifiedProps> = ({
  paperBalance,
  portfolioValue,
  analytics,
  riskSummary,
  holdings,
  onNavigate,
}) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _totalEquity = paperBalance + portfolioValue;
  const totalPnl = analytics.unrealizedPnl;

  return (
    <div style={{ background: '#090d16', border: '1px solid #334155', borderRadius: '0.85rem', padding: '1.5rem', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.25rem' }}>⚡</span>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#38bdf8' }}>
              Portfolio Command Center — Unified Executive Operations View
            </h2>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Unified real-time executive cockpit integrating Health, Performance, Risk, Drawdown, Strategy and Journal analytics
          </span>
        </div>

        {/* Status Badge */}
        <div style={{ background: '#1e293b', border: '1px solid #0284c7', borderRadius: '0.5rem', padding: '0.45rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>EXECUTIVE STATE:</span>
          <strong style={{ color: '#38bdf8', fontSize: '0.85rem' }}>OPERATIONAL READ-ONLY</strong>
        </div>
      </div>

      {/* Executive Status Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.75rem 0.85rem' }}>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>PERFORMANCE</span>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '1rem', fontWeight: 800, color: totalPnl >= 0 ? '#4ade80' : '#f87171' }}>
            {totalPnl >= 0 ? '+' : ''}₹{totalPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.75rem 0.85rem' }}>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>RISK HEALTH</span>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '1rem', fontWeight: 800, color: riskSummary.healthStatus === 'LOW' ? '#4ade80' : '#fbbf24' }}>
            {riskSummary.healthStatus} RISK
          </p>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.75rem', padding: '0.75rem 0.85rem' }}>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>EXPOSURE</span>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
            {riskSummary.exposurePercent.toFixed(1)}% Ratio
          </p>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.75rem 0.85rem' }}>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>POSITIONS</span>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '1rem', fontWeight: 800, color: '#f8fafc' }}>
            {holdings.length} Active
          </p>
        </div>
      </div>

      {/* Quick Navigation Cards Bar */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => onNavigate?.('/strategy')}
          style={{ flex: 1, minWidth: '120px', padding: '0.45rem 0.75rem', borderRadius: '0.375rem', background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
        >
          🎯 Strategy Hub
        </button>
        <button
          type="button"
          onClick={() => onNavigate?.('/orders')}
          style={{ flex: 1, minWidth: '120px', padding: '0.45rem 0.75rem', borderRadius: '0.375rem', background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
        >
          📋 Orders Hub
        </button>
        <button
          type="button"
          onClick={() => onNavigate?.('/journal')}
          style={{ flex: 1, minWidth: '120px', padding: '0.45rem 0.75rem', borderRadius: '0.375rem', background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
        >
          📖 Trading Journal
        </button>
      </div>
    </div>
  );
};
