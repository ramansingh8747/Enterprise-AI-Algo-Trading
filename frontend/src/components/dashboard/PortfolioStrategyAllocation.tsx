import React from 'react';
import { PaperHolding } from '@/types/paperPortfolio';

interface PortfolioStrategyAllocationProps {
  holdings: PaperHolding[];
  portfolioValue: number;
}

export const PortfolioStrategyAllocation: React.FC<PortfolioStrategyAllocationProps> = ({
  holdings,
  portfolioValue,
}) => {
  const totalVal = portfolioValue > 0 ? portfolioValue : holdings.reduce((sum, h) => sum + (h.currentValue || h.investedValue || 0), 0);

  const items = holdings.map(h => {
    const val = h.currentValue || h.investedValue || 0;
    const pct = totalVal > 0 ? (val / totalVal) * 100 : 0;
    return {
      symbol: h.symbol,
      value: val,
      percentage: pct,
    };
  }).sort((a, b) => b.value - a.value);

  const topHolding = items[0] || null;
  const topConcentrationPct = topHolding ? topHolding.percentage : 0;

  const concentrationStatus = topConcentrationPct > 40 ? 'HIGH CONCENTRATION' : topConcentrationPct > 25 ? 'MODERATE CONCENTRATION' : 'BALANCED';
  const statusColor = topConcentrationPct > 40 ? '#f87171' : topConcentrationPct > 25 ? '#fbbf24' : '#4ade80';

  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
          Portfolio Strategy Allocation & Concentration Intelligence
        </h3>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          Capital distribution, top holding weights and portfolio concentration analysis
        </span>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Active Assets</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8' }}>
            {holdings.length} Positions
          </p>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Largest Holding Weight</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: statusColor }}>
            {topHolding ? `${topHolding.symbol} (${topConcentrationPct.toFixed(1)}%)` : 'None'}
          </p>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Concentration Health</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: statusColor }}>
            {concentrationStatus}
          </p>
        </div>
      </div>

      {/* Visual Weight Distribution Bar */}
      {items.length > 0 && (
        <div style={{ background: '#0f172a', borderRadius: '0.5rem', padding: '0.85rem 1rem', border: '1px solid #334155' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '0.5rem' }}>
            TOP HOLDING WEIGHT BREAKDOWN
          </span>
          <div style={{ display: 'flex', height: '0.75rem', borderRadius: '0.375rem', overflow: 'hidden', background: '#1e293b' }}>
            {items.slice(0, 5).map((item, idx) => {
              const colors = ['#38bdf8', '#4ade80', '#fbbf24', '#a78bfa', '#f87171'];
              return (
                <div
                  key={item.symbol}
                  style={{ width: `${item.percentage}%`, background: colors[idx % colors.length], transition: 'width 0.3s' }}
                  title={`${item.symbol}: ${item.percentage.toFixed(1)}%`}
                />
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.5rem' }}>
            {items.slice(0, 5).map((item, idx) => {
              const colors = ['#38bdf8', '#4ade80', '#fbbf24', '#a78bfa', '#f87171'];
              return (
                <span key={item.symbol} style={{ color: colors[idx % colors.length] }}>
                  ● {item.symbol} ({item.percentage.toFixed(1)}%)
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
