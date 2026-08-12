import React, { useState } from 'react';
import { MonitoredPosition } from '@/types/positionMonitor';

interface PortfolioStressTestProps {
  positions: MonitoredPosition[];
  portfolioValue: number;
}

export const PortfolioStressTest: React.FC<PortfolioStressTestProps> = ({
  positions,
  portfolioValue,
}) => {
  const [scenarioPct, setScenarioPct] = useState<number>(0);

  const scenarioOptions = [-10, -5, -2, 0, 2, 5, 10];

  const estimatedPnlChange = positions.reduce((sum, p) => {
    const factor = p.side === 'SHORT' ? -1 : 1;
    return sum + p.currentValue * (scenarioPct / 100) * factor;
  }, 0);

  const estimatedPortfolioValue = portfolioValue + estimatedPnlChange;

  return (
    <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
              Portfolio Risk Scenario & Stress Intelligence
            </h3>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#fbbf24', background: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.3)', padding: '0.1rem 0.4rem', borderRadius: '0.2rem' }}>
              READ-ONLY SIMULATION
            </span>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Simulate market shock percentage impact on active positions without affecting real portfolio
          </span>
        </div>

        {scenarioPct !== 0 && (
          <button
            type="button"
            onClick={() => setScenarioPct(0)}
            style={{ padding: '0.35rem 0.75rem', borderRadius: '0.375rem', background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
          >
            ↺ Reset Scenario (0%)
          </button>
        )}
      </div>

      {/* Scenario Selector Buttons */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, marginRight: '0.5rem' }}>Market Shock:</span>
        {scenarioOptions.map(pct => {
          const isSelected = scenarioPct === pct;
          const isNegative = pct < 0;
          const isPositive = pct > 0;
          const color = isNegative ? '#f87171' : isPositive ? '#4ade80' : '#cbd5e1';

          return (
            <button
              key={pct}
              type="button"
              onClick={() => setScenarioPct(pct)}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '0.375rem',
                fontWeight: 800,
                fontSize: '0.8rem',
                cursor: 'pointer',
                background: isSelected ? `${color}25` : '#1e293b',
                border: isSelected ? `1px solid ${color}` : '1px solid #334155',
                color: isSelected ? color : '#94a3b8',
              }}
            >
              {pct > 0 ? `+${pct}%` : `${pct}%`}
            </button>
          );
        })}
      </div>

      {/* Scenario Impact Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Simulated Scenario</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: scenarioPct < 0 ? '#f87171' : scenarioPct > 0 ? '#4ade80' : '#cbd5e1' }}>
            {scenarioPct > 0 ? `+${scenarioPct}%` : `${scenarioPct}%`} Price Move
          </p>
        </div>

        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Estimated Impact</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: estimatedPnlChange >= 0 ? '#4ade80' : '#f87171' }}>
            {estimatedPnlChange >= 0 ? '+' : ''}₹{estimatedPnlChange.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Simulated Portfolio Value</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8' }}>
            ₹{estimatedPortfolioValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Position Stress Table */}
      {positions.length > 0 && (
        <div style={{ overflowX: 'auto', background: '#1e293b', borderRadius: '0.5rem', border: '1px solid #334155' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', background: '#08111f' }}>
                <th style={{ padding: '0.65rem 0.85rem' }}>Symbol</th>
                <th style={{ padding: '0.65rem 0.85rem' }}>Side</th>
                <th style={{ padding: '0.65rem 0.85rem' }}>Current Value</th>
                <th style={{ padding: '0.65rem 0.85rem' }}>Scenario %</th>
                <th style={{ padding: '0.65rem 0.85rem' }}>Hypothetical Impact</th>
              </tr>
            </thead>
            <tbody>
              {positions.map(p => {
                const factor = p.side === 'SHORT' ? -1 : 1;
                const posImpact = p.currentValue * (scenarioPct / 100) * factor;
                const impactColor = posImpact > 0 ? '#4ade80' : posImpact < 0 ? '#f87171' : '#94a3b8';

                return (
                  <tr key={p.symbol} style={{ borderBottom: '1px solid #0f172a' }}>
                    <td style={{ padding: '0.65rem 0.85rem', fontWeight: 800, color: '#f8fafc' }}>{p.symbol}</td>
                    <td style={{ padding: '0.65rem 0.85rem', color: p.side === 'LONG' ? '#4ade80' : '#f87171', fontWeight: 700 }}>{p.side}</td>
                    <td style={{ padding: '0.65rem 0.85rem', color: '#cbd5e1' }}>₹{p.currentValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: '0.65rem 0.85rem', color: '#cbd5e1' }}>{scenarioPct > 0 ? `+${scenarioPct}%` : `${scenarioPct}%`}</td>
                    <td style={{ padding: '0.65rem 0.85rem', fontWeight: 800, color: impactColor }}>
                      {posImpact > 0 ? '+' : ''}₹{posImpact.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
