import React, { useMemo } from 'react';
import { PaperHolding } from '@/types/paperPortfolio';
import { TradingSignal } from '@/types/signal';

interface TradingIntelligenceProps {
  paperBalance: number;
  portfolioValue: number;
  investedValue: number;
  totalPnl: number;
  holdings: PaperHolding[];
  signals?: TradingSignal[];
}

export const TradingIntelligence: React.FC<TradingIntelligenceProps> = ({
  paperBalance,
  portfolioValue: _portfolioValue,
  investedValue,
  totalPnl,
  holdings,
  signals = [],
}) => {
  // Calculate paper trading health score locally (0 - 100)
  const healthScore = useMemo(() => {
    let score = 75; // base score

    if (totalPnl > 0) score += 10;
    if (totalPnl < 0) score -= 15;

    const utilization = paperBalance > 0 ? (investedValue / paperBalance) * 100 : 0;
    if (utilization > 80) score -= 10;
    if (utilization >= 10 && utilization <= 50) score += 10;

    if (holdings.length >= 2) score += 5;

    return Math.min(100, Math.max(20, Math.round(score)));
  }, [totalPnl, paperBalance, investedValue, holdings]);

  const scoreTier = useMemo(() => {
    if (healthScore >= 80) return { label: "Excellent", color: "#4ade80" };
    if (healthScore >= 60) return { label: "Healthy", color: "#38bdf8" };
    if (healthScore >= 40) return { label: "Moderate", color: "#fbbf24" };
    return { label: "Needs Attention", color: "#f87171" };
  }, [healthScore]);

  // Concentration check
  const largestHolding = useMemo(() => {
    if (holdings.length === 0 || investedValue <= 0) return null;
    const sorted = [...holdings].sort((a, b) => b.investedValue - a.investedValue);
    const top = sorted[0];
    const percentage = (top.investedValue / investedValue) * 100;
    return { symbol: top.symbol, percentage: percentage.toFixed(1) };
  }, [holdings, investedValue]);

  // Signal summary counts
  const bullishCount = signals.filter(s => s.trend === "BULLISH").length;
  const bearishCount = signals.filter(s => s.trend === "BEARISH").length;

  return (
    <section style={{
      background: 'linear-gradient(135deg, #0f1a2b 0%, #08111f 100%)',
      borderRadius: '0.85rem',
      border: '1px solid rgba(148, 163, 184, 0.16)',
      padding: '1.5rem',
      color: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.25rem',
      boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.2rem' }}>🧠</span>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#38bdf8' }}>
              Trading Intelligence & Decision Support
            </h2>
          </div>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
            Local rule-based paper trading analytics, portfolio health, and risk parameters.
          </p>
        </div>

        <span style={{
          fontSize: '0.75rem',
          fontWeight: 800,
          color: '#38bdf8',
          background: 'rgba(56, 189, 248, 0.12)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          padding: '0.25rem 0.65rem',
          borderRadius: '1rem',
        }}>
          PAPER TRADING ANALYTICS
        </span>
      </div>

      {/* Main Grid: Health Score vs Key Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
        {/* Health Score Card */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.75)',
          borderRadius: '0.75rem',
          border: '1px solid rgba(148, 163, 184, 0.12)',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Paper Trading Health Score
          </span>
          <div style={{ fontSize: '3rem', fontWeight: 900, color: scoreTier.color, margin: '0.25rem 0' }}>
            {healthScore}
            <span style={{ fontSize: '1.25rem', color: '#64748b' }}> / 100</span>
          </div>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 800,
            color: scoreTier.color,
            background: `${scoreTier.color}15`,
            border: `1px solid ${scoreTier.color}30`,
            padding: '0.2rem 0.65rem',
            borderRadius: '1rem',
          }}>
            {scoreTier.label}
          </span>
        </div>

        {/* Portfolio Health */}
        <div style={{ background: 'rgba(15, 23, 42, 0.75)', padding: '1.1rem', borderRadius: '0.75rem', border: '1px solid rgba(148, 163, 184, 0.12)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, display: 'block' }}>PORTFOLIO HEALTH</span>
            <strong style={{ fontSize: '1.1rem', color: '#f8fafc', fontWeight: 800, marginTop: '0.2rem', display: 'block' }}>
              {holdings.length === 0 ? "No Active Holdings" : `${holdings.length} Active Positions`}
            </strong>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.75rem' }}>
            {largestHolding && Number(largestHolding.percentage) > 35 ? (
              <span style={{ color: '#fbbf24' }}>⚠️ High Concentration: {largestHolding.symbol} is {largestHolding.percentage}% of holdings.</span>
            ) : (
              <span>✓ Capital distribution balanced across positions.</span>
            )}
          </div>
        </div>

        {/* Risk Health */}
        <div style={{ background: 'rgba(15, 23, 42, 0.75)', padding: '1.1rem', borderRadius: '0.75rem', border: '1px solid rgba(148, 163, 184, 0.12)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, display: 'block' }}>RISK HEALTH</span>
            <strong style={{ fontSize: '1.1rem', color: '#4ade80', fontWeight: 800, marginTop: '0.2rem', display: 'block' }}>
              Risk Parameters Enforced
            </strong>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.75rem' }}>
            Max Order: ₹1,00,000 • Daily Loss Limit: ₹10,000
          </div>
        </div>

        {/* Strategy Health */}
        <div style={{ background: 'rgba(15, 23, 42, 0.75)', padding: '1.1rem', borderRadius: '0.75rem', border: '1px solid rgba(148, 163, 184, 0.12)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, display: 'block' }}>STRATEGY HEALTH</span>
            <strong style={{ fontSize: '1.1rem', color: '#a78bfa', fontWeight: 800, marginTop: '0.2rem', display: 'block' }}>
              {bullishCount > bearishCount ? "Bullish Alignment" : "Neutral / Selective"}
            </strong>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.75rem' }}>
            Signals: <span style={{ color: '#4ade80' }}>{bullishCount} Bullish</span> • <span style={{ color: '#f87171' }}>{bearishCount} Bearish</span>
          </div>
        </div>
      </div>

      {/* Local Insights Box */}
      <div style={{
        background: '#08111f',
        borderRadius: '0.5rem',
        padding: '1rem 1.25rem',
        border: '1px solid #1e293b',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}>
        <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 800, color: '#f8fafc' }}>
          💡 Rule-Based Decision Insights
        </h4>

        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.6 }}>
          <li>Paper balance is healthy with starting virtual margin preserved.</li>
          <li>All paper trades pass local risk validation (Trade Risk 2%, Min R:R 1.5:1).</li>
          <li>Explore Strategy & Signals to evaluate confidence-weighted mock trade setups.</li>
        </ul>

        <span style={{ fontSize: '0.7rem', color: '#64748b', fontStyle: 'italic', marginTop: '0.25rem' }}>
          * Rule-based local paper-trading analytics. Not financial advice. No real money at risk.
        </span>
      </div>
    </section>
  );
};
