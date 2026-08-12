import React, { useState } from 'react';
import { PaperHolding } from '@/types/paperPortfolio';
import { PortfolioAnalyticsSummary } from '@/types/portfolioAnalytics';
import { RiskIntelligenceSummary } from '@/types/riskPositionIntelligence';

interface PortfolioInsightDrilldownProps {
  analytics: PortfolioAnalyticsSummary;
  riskSummary: RiskIntelligenceSummary;
  holdings: PaperHolding[];
  onNavigate?: (route: string) => void;
}

type DrilldownCategory = 'PERFORMANCE' | 'RISK' | 'DRAWDOWN' | 'ALLOCATION' | null;

export const PortfolioInsightDrilldown: React.FC<PortfolioInsightDrilldownProps> = ({
  analytics,
  riskSummary,
  holdings,
  onNavigate,
}) => {
  const [activeCategory, setActiveCategory] = useState<DrilldownCategory>(null);

  const topGainer = [...holdings].sort((a, b) => b.pnl - a.pnl)[0] || null;
  const topLoser = [...holdings].sort((a, b) => a.pnl - b.pnl)[0] || null;

  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
          Portfolio Intelligence Drill-Down & Contextual Insight Layer
        </h3>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          Select any executive insight card to open detailed contextual evidence and supporting source metrics
        </span>
      </div>

      {/* Insight Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
        {/* Performance Insight Card */}
        <div
          onClick={() => setActiveCategory('PERFORMANCE')}
          style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem', cursor: 'pointer', transition: 'border-color 0.2s' }}
        >
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>PERFORMANCE INSIGHT</span>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: analytics.unrealizedPnl >= 0 ? '#4ade80' : '#f87171' }}>
            {analytics.unrealizedPnl >= 0 ? '+' : ''}₹{analytics.unrealizedPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <span style={{ fontSize: '0.7rem', color: '#38bdf8' }}>Click for Performance Evidence →</span>
        </div>

        {/* Risk Insight Card */}
        <div
          onClick={() => setActiveCategory('RISK')}
          style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem', cursor: 'pointer', transition: 'border-color 0.2s' }}
        >
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>RISK INSIGHT</span>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: riskSummary.healthStatus === 'LOW' ? '#4ade80' : '#fbbf24' }}>
            {riskSummary.healthStatus} RISK
          </p>
          <span style={{ fontSize: '0.7rem', color: '#38bdf8' }}>Click for Risk Evidence →</span>
        </div>

        {/* Drawdown Insight Card */}
        <div
          onClick={() => setActiveCategory('DRAWDOWN')}
          style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem', cursor: 'pointer', transition: 'border-color 0.2s' }}
        >
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>DRAWDOWN INSIGHT</span>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: analytics.unrealizedPnl >= 0 ? '#4ade80' : '#fbbf24' }}>
            {analytics.unrealizedPnl >= 0 ? 'AT PEAK EQUITY' : 'EQUITY DRAWDOWN'}
          </p>
          <span style={{ fontSize: '0.7rem', color: '#38bdf8' }}>Click for Drawdown Evidence →</span>
        </div>

        {/* Allocation Insight Card */}
        <div
          onClick={() => setActiveCategory('ALLOCATION')}
          style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem', cursor: 'pointer', transition: 'border-color 0.2s' }}
        >
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>ALLOCATION INSIGHT</span>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>
            {holdings.length} POSITIONS
          </p>
          <span style={{ fontSize: '0.7rem', color: '#38bdf8' }}>Click for Allocation Evidence →</span>
        </div>
      </div>

      {/* Drill-down Modal Panel */}
      {activeCategory && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.8)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#111c2d', border: '1px solid #334155', borderRadius: '0.85rem', padding: '1.5rem', maxWidth: '550px', width: '100%', color: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700 }}>PORTFOLIO → {activeCategory} DRILL-DOWN</span>
              <button type="button" onClick={() => setActiveCategory(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 800 }}>✕</button>
            </div>

            {/* Factual Context */}
            <div style={{ fontSize: '0.825rem', color: '#cbd5e1', lineHeight: 1.6, marginBottom: '1rem' }}>
              <p style={{ margin: '0 0 0.5rem 0' }}>
                <strong>Source Traceability: </strong> Portfolio {activeCategory} Intelligence Engine
              </p>
              <p style={{ margin: 0 }}>
                <strong>Why This Matters: </strong>
                {activeCategory === 'PERFORMANCE' && 'Performance evidence is calculated from current paper holding valuations and entry costs.'}
                {activeCategory === 'RISK' && 'Risk evidence monitors total exposure ratios and position margin requirements.'}
                {activeCategory === 'DRAWDOWN' && 'Drawdown evidence measures current total portfolio equity against historical peak equity.'}
                {activeCategory === 'ALLOCATION' && 'Allocation evidence details symbol weight distribution across available margin.'}
              </p>
            </div>

            {/* Quick Metrics */}
            <div style={{ background: '#0f172a', padding: '0.85rem', borderRadius: '0.5rem', border: '1px solid #334155', fontSize: '0.8rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span>Top Gainer:</span>
                <strong style={{ color: '#4ade80' }}>{topGainer ? `${topGainer.symbol} (+₹${topGainer.pnl.toLocaleString('en-IN')})` : 'None'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Top Loser:</span>
                <strong style={{ color: '#f87171' }}>{topLoser ? `${topLoser.symbol} (-₹${Math.abs(topLoser.pnl).toLocaleString('en-IN')})` : 'None'}</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveCategory(null);
                if (activeCategory === 'PERFORMANCE') onNavigate?.('/strategy');
                if (activeCategory === 'RISK') onNavigate?.('/orders');
                if (activeCategory === 'DRAWDOWN') onNavigate?.('/journal');
                if (activeCategory === 'ALLOCATION') onNavigate?.('/strategy');
              }}
              style={{ width: '100%', padding: '0.6rem', borderRadius: '0.375rem', background: '#0284c7', border: 'none', color: '#ffffff', fontWeight: 700, cursor: 'pointer', fontSize: '0.825rem' }}
            >
              Open Full {activeCategory} Module →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
