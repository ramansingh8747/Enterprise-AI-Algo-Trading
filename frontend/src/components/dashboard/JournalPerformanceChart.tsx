import React, { useMemo } from 'react';
import { TradingJournalEntry } from '@/types/tradingJournal';

interface JournalPerformanceChartProps {
  entries: TradingJournalEntry[];
}

export const JournalPerformanceChart: React.FC<JournalPerformanceChartProps> = ({ entries }) => {
  const chartPoints = useMemo(() => {
    if (!entries || entries.length === 0) return [];
    const completed = [...entries].reverse().filter(e => e.result !== 'OPEN');
    let cumulative = 0;
    return completed.map((e, index) => {
      cumulative += e.realizedPnl || 0;
      return { index, symbol: e.symbol, pnl: e.realizedPnl || 0, cumulative };
    });
  }, [entries]);

  if (chartPoints.length === 0) {
    return (
      <div style={{ background: '#0f172a', borderRadius: '0.75rem', border: '1px solid rgba(148,163,184,0.18)', padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>
        <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Cumulative P&L Performance Chart</span>
        <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.75rem' }}>No completed trade records to display chart.</p>
      </div>
    );
  }

  const minVal = Math.min(0, ...chartPoints.map(p => p.cumulative));
  const maxVal = Math.max(100, ...chartPoints.map(p => p.cumulative));
  const range = maxVal - minVal || 1;

  const width = 600;
  const height = 140;

  const pointsStr = chartPoints.map((p, idx) => {
    const x = chartPoints.length > 1 ? (idx / (chartPoints.length - 1)) * (width - 40) + 20 : width / 2;
    const y = height - 20 - ((p.cumulative - minVal) / range) * (height - 40);
    return `${x},${y}`;
  }).join(' ');

  const isOverallProfit = (chartPoints[chartPoints.length - 1]?.cumulative || 0) >= 0;
  const strokeColor = isOverallProfit ? '#4ade80' : '#f87171';

  return (
    <div style={{ background: '#0f172a', borderRadius: '0.75rem', border: '1px solid rgba(148,163,184,0.18)', padding: '1.25rem', color: '#f8fafc' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#f8fafc' }}>
          Cumulative Paper P&L Performance
        </h3>
        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: strokeColor }}>
          Total: {isOverallProfit ? '+' : ''}₹{chartPoints[chartPoints.length - 1].cumulative.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '140px' }}>
          {/* Zero line */}
          <line
            x1="20"
            y1={height - 20 - ((0 - minVal) / range) * (height - 40)}
            x2={width - 20}
            y2={height - 20 - ((0 - minVal) / range) * (height - 40)}
            stroke="rgba(148, 163, 184, 0.25)"
            strokeDasharray="4"
          />
          {/* Trend Polyline */}
          <polyline
            fill="none"
            stroke={strokeColor}
            strokeWidth="3"
            points={pointsStr}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
};
