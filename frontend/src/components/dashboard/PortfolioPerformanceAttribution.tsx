import React from 'react';
import { PaperHolding } from '@/types/paperPortfolio';
import { PortfolioAnalyticsSummary } from '@/types/portfolioAnalytics';

interface PortfolioPerformanceAttributionProps {
  analytics: PortfolioAnalyticsSummary;
  holdings: PaperHolding[];
}

export const PortfolioPerformanceAttribution: React.FC<PortfolioPerformanceAttributionProps> = ({
  analytics,
  holdings,
}) => {
  const totalPnl = analytics.unrealizedPnl;

  const topGainer = [...holdings].sort((a, b) => b.pnl - a.pnl)[0] || null;
  const topLoser = [...holdings].sort((a, b) => a.pnl - b.pnl)[0] || null;

  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
          Portfolio Performance Attribution & Contribution Intelligence
        </h3>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          Detailed attribution analysis explaining sources of realized and unrealized portfolio P&L
        </span>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Total Portfolio P&L</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: totalPnl >= 0 ? '#4ade80' : '#f87171' }}>
            {totalPnl >= 0 ? '+' : ''}₹{totalPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Top P&L Contributor</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: '#4ade80' }}>
            {topGainer && topGainer.pnl > 0 ? `${topGainer.symbol} (+₹${topGainer.pnl.toLocaleString('en-IN')})` : 'None'}
          </p>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Bottom P&L Contributor</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: '#f87171' }}>
            {topLoser && topLoser.pnl < 0 ? `${topLoser.symbol} (-₹${Math.abs(topLoser.pnl).toLocaleString('en-IN')})` : 'None'}
          </p>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Win / Loss Position Ratio</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: '#cbd5e1' }}>
            <span style={{ color: '#4ade80' }}>{analytics.winningCount} Win</span> / <span style={{ color: '#f87171' }}>{analytics.losingCount} Loss</span>
          </p>
        </div>
      </div>

      {/* Position Contribution Ranking Table */}
      {holdings.length > 0 && (
        <div style={{ overflowX: 'auto', background: '#0f172a', borderRadius: '0.5rem', border: '1px solid #334155' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', background: '#08111f' }}>
                <th style={{ padding: '0.65rem 0.85rem' }}>Symbol</th>
                <th style={{ padding: '0.65rem 0.85rem' }}>Market Value</th>
                <th style={{ padding: '0.65rem 0.85rem' }}>P&L (₹)</th>
                <th style={{ padding: '0.65rem 0.85rem' }}>Return %</th>
                <th style={{ padding: '0.65rem 0.85rem' }}>Portfolio Contribution %</th>
              </tr>
            </thead>
            <tbody>
              {[...holdings].sort((a, b) => b.pnl - a.pnl).map(h => {
                const isPositive = h.pnl > 0;
                const isNegative = h.pnl < 0;
                const color = isPositive ? '#4ade80' : isNegative ? '#f87171' : '#94a3b8';
                const contribPct = Math.abs(totalPnl) > 0 ? (h.pnl / Math.abs(totalPnl)) * 100 : 0;

                return (
                  <tr key={h.symbol} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '0.65rem 0.85rem', fontWeight: 800, color: '#f8fafc' }}>{h.symbol}</td>
                    <td style={{ padding: '0.65rem 0.85rem', color: '#cbd5e1' }}>₹{h.currentValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: '0.65rem 0.85rem', fontWeight: 800, color }}>
                      {isPositive ? '+' : ''}₹{h.pnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color }}>
                      {isPositive ? '+' : ''}{h.pnlPercent.toFixed(2)}%
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem', color: '#38bdf8', fontWeight: 700 }}>
                      {contribPct >= 0 ? '+' : ''}{contribPct.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
