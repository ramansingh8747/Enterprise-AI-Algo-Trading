import React, { useState } from 'react';
import { PaperHolding } from '@/types/paperPortfolio';
import { PortfolioAnalyticsSummary } from '@/types/portfolioAnalytics';

interface PortfolioPerformanceIntelligenceProps {
  analytics: PortfolioAnalyticsSummary;
  holdings: PaperHolding[];
  onSelectHolding?: (holding: PaperHolding) => void;
}

export type PerformancePeriod = 'TODAY' | '7D' | '30D' | 'ALL';

export const PortfolioPerformanceIntelligence: React.FC<PortfolioPerformanceIntelligenceProps> = ({
  analytics,
  holdings,
  onSelectHolding,
}) => {
  const [period, setPeriod] = useState<PerformancePeriod>('ALL');

  const topGainer = analytics.topGainer;
  const topLoser = analytics.topLoser;

  const totalPositions = holdings.length;
  const longCount = holdings.filter(h => h.quantity > 0).length;
  const shortCount = holdings.filter(h => h.quantity < 0).length;

  const unrealizedPnl = analytics.unrealizedPnl;
  const isPositivePnl = unrealizedPnl >= 0;

  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem', color: '#f8fafc' }}>
      {/* Section Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#38bdf8' }}>
            P&L Performance & Contribution Intelligence
          </h3>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Realized vs Unrealized P&L breakdown, side performance and position contributors
          </span>
        </div>

        {/* Period Filter */}
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          {(['TODAY', '7D', '30D', 'ALL'] as PerformancePeriod[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '0.3rem 0.65rem',
                borderRadius: '0.25rem',
                fontWeight: 700,
                fontSize: '0.75rem',
                cursor: 'pointer',
                background: period === p ? '#0284c7' : '#0f172a',
                border: '1px solid #334155',
                color: period === p ? '#ffffff' : '#94a3b8',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Grid: Realized vs Unrealized P&L Cards & Side Performance */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        {/* Unrealized P&L Card */}
        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.65rem', padding: '1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Unrealized P&L</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: isPositivePnl ? '#4ade80' : '#f87171', marginTop: '0.25rem' }}>
            {isPositivePnl ? '+' : ''}₹{unrealizedPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isPositivePnl ? '#4ade80' : '#f87171' }}>
            {analytics.unrealizedPnlPercent >= 0 ? '+' : ''}{analytics.unrealizedPnlPercent.toFixed(2)}%
          </span>
        </div>

        {/* Win / Loss Position Count Card */}
        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.65rem', padding: '1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Winning vs Losing Positions</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f8fafc', marginTop: '0.25rem' }}>
            <span style={{ color: '#4ade80' }}>{analytics.winningCount}</span> / <span style={{ color: '#f87171' }}>{analytics.losingCount}</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Win Rate: {totalPositions > 0 ? ((analytics.winningCount / totalPositions) * 100).toFixed(0) : 0}%
          </span>
        </div>

        {/* Long vs Short Side Performance Card */}
        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.65rem', padding: '1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Side Breakdown</span>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.25rem' }}>
            <span style={{ color: '#4ade80' }}>{longCount} Long</span> | <span style={{ color: '#f87171' }}>{shortCount} Short</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Total Tracked: {totalPositions}
          </span>
        </div>
      </div>

      {/* Top & Worst Performers Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        {/* Top Performer */}
        <div style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.25)', borderRadius: '0.65rem', padding: '1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 700 }}>TOP PERFORMER</span>
          {topGainer ? (
            <div style={{ marginTop: '0.35rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '1.1rem', color: '#f8fafc' }}>{topGainer.symbol}</strong>
                <button
                  onClick={() => onSelectHolding?.(topGainer)}
                  style={{ background: 'transparent', border: 'none', color: '#4ade80', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                >
                  View Details →
                </button>
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#4ade80', marginTop: '0.2rem' }}>
                +₹{topGainer.pnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (+{topGainer.pnlPercent.toFixed(2)}%)
              </div>
            </div>
          ) : (
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>No positive position contributors yet.</p>
          )}
        </div>

        {/* Worst Performer */}
        <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '0.65rem', padding: '1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 700 }}>WORST PERFORMER</span>
          {topLoser ? (
            <div style={{ marginTop: '0.35rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '1.1rem', color: '#f8fafc' }}>{topLoser.symbol}</strong>
                <button
                  onClick={() => onSelectHolding?.(topLoser)}
                  style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                >
                  View Details →
                </button>
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f87171', marginTop: '0.2rem' }}>
                ₹{topLoser.pnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({topLoser.pnlPercent.toFixed(2)}%)
              </div>
            </div>
          ) : (
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>No negative position contributors.</p>
          )}
        </div>
      </div>
    </div>
  );
};
