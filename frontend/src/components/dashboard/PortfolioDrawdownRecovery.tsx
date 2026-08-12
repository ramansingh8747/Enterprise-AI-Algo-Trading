import React from 'react';
import { PaperHolding } from '@/types/paperPortfolio';

interface PortfolioDrawdownRecoveryProps {
  paperBalance: number;
  portfolioValue: number;
  unrealizedPnl: number;
  holdings: PaperHolding[];
}

export const PortfolioDrawdownRecovery: React.FC<PortfolioDrawdownRecoveryProps> = ({
  paperBalance,
  portfolioValue,
  unrealizedPnl: _unrealizedPnl,
  holdings,
}) => {
  const initialCapital = 1000000;
  const currentTotalEquity = paperBalance + portfolioValue;

  const peakValue = Math.max(initialCapital, currentTotalEquity);
  const drawdownAmount = currentTotalEquity < peakValue ? peakValue - currentTotalEquity : 0;
  const drawdownPct = peakValue > 0 ? (drawdownAmount / peakValue) * 100 : 0;

  const isAtPeak = currentTotalEquity >= peakValue;
  const drawdownStatus = isAtPeak ? 'AT PEAK EQUITY' : drawdownPct > 10 ? 'SIGNIFICANT DRAWDOWN' : 'MINOR DRAWDOWN';
  const statusColor = isAtPeak ? '#4ade80' : drawdownPct > 10 ? '#f87171' : '#fbbf24';

  const recoveryPct = peakValue > initialCapital ? ((currentTotalEquity - initialCapital) / (peakValue - initialCapital)) * 100 : 100;

  const topLoser = [...holdings].sort((a, b) => a.pnl - b.pnl)[0] || null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _topGainer = [...holdings].sort((a, b) => b.pnl - a.pnl)[0] || null;

  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
          Portfolio Drawdown & Recovery Intelligence
        </h3>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          Peak equity tracking, current drawdown distance and recovery trajectory
        </span>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Equity Posture</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: statusColor }}>
            {drawdownStatus}
          </p>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Peak Portfolio Value</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8' }}>
            ₹{peakValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Current Drawdown</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: drawdownAmount > 0 ? '#f87171' : '#4ade80' }}>
            {drawdownAmount > 0 ? `-₹${drawdownAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${drawdownPct.toFixed(2)}%)` : '₹0.00 (0.00%)'}
          </p>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Top Drawdown Contributor</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: '#f87171' }}>
            {topLoser && topLoser.pnl < 0 ? `${topLoser.symbol} (-₹${Math.abs(topLoser.pnl).toLocaleString('en-IN')})` : 'None'}
          </p>
        </div>
      </div>

      {/* Visual Recovery Progress Bar */}
      <div style={{ background: '#0f172a', borderRadius: '0.5rem', padding: '0.85rem 1rem', border: '1px solid #334155' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
          <span>EQUITY RECOVERY TRAJECTORY</span>
          <span style={{ color: statusColor, fontWeight: 700 }}>{isAtPeak ? '100% (At Peak)' : `${Math.max(0, recoveryPct).toFixed(1)}% Recovered`}</span>
        </div>
        <div style={{ height: '0.65rem', background: '#1e293b', borderRadius: '9999px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, isAtPeak ? 100 : recoveryPct))}%`, background: statusColor, transition: 'width 0.3s' }} />
        </div>
      </div>
    </div>
  );
};
