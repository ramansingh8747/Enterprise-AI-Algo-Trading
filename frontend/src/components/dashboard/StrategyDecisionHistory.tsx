import React from 'react';
import { TradingSignal } from '@/types/signal';

interface StrategyDecisionHistoryProps {
  signals: TradingSignal[];
  onSelectSignal?: (signal: TradingSignal) => void;
}

export const StrategyDecisionHistory: React.FC<StrategyDecisionHistoryProps> = ({
  signals,
  onSelectSignal,
}) => {
  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
          Strategy Decision History & Signal-to-Outcome Analytics
        </h3>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          Track signal execution flows from signal generation to paper trade outcomes
        </span>
      </div>

      {/* Decision History Table */}
      <div style={{ overflowX: 'auto', background: '#0f172a', borderRadius: '0.5rem', border: '1px solid #334155' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', background: '#08111f' }}>
              <th style={{ padding: '0.65rem 0.85rem' }}>Timestamp</th>
              <th style={{ padding: '0.65rem 0.85rem' }}>Symbol</th>
              <th style={{ padding: '0.65rem 0.85rem' }}>Strategy</th>
              <th style={{ padding: '0.65rem 0.85rem' }}>Action</th>
              <th style={{ padding: '0.65rem 0.85rem' }}>Strength</th>
              <th style={{ padding: '0.65rem 0.85rem' }}>Entry / Target / SL</th>
              <th style={{ padding: '0.65rem 0.85rem' }}>Outcome Status</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((s, idx) => {
              const isBuy = s.action === 'BUY';
              const isSell = s.action === 'SELL';
              const actionColor = isBuy ? '#4ade80' : isSell ? '#f87171' : '#94a3b8';

              return (
                <tr
                  key={idx}
                  onClick={() => onSelectSignal?.(s)}
                  style={{ borderBottom: '1px solid #1e293b', cursor: 'pointer' }}
                >
                  <td style={{ padding: '0.65rem 0.85rem', color: '#94a3b8' }}>
                    {new Date(s.generatedAt || Date.now()).toLocaleTimeString()}
                  </td>
                  <td style={{ padding: '0.65rem 0.85rem', fontWeight: 800, color: '#f8fafc' }}>
                    {s.symbol}
                  </td>
                  <td style={{ padding: '0.65rem 0.85rem', color: '#a78bfa', fontWeight: 600 }}>
                    {s.strategy}
                  </td>
                  <td style={{ padding: '0.65rem 0.85rem', fontWeight: 800, color: actionColor }}>
                    {s.action}
                  </td>
                  <td style={{ padding: '0.65rem 0.85rem', color: '#38bdf8', fontWeight: 700 }}>
                    {s.strength}%
                  </td>
                  <td style={{ padding: '0.65rem 0.85rem', color: '#cbd5e1' }}>
                    ₹{s.entryPrice} / ₹{s.targetPrice} / ₹{s.stopLoss}
                  </td>
                  <td style={{ padding: '0.65rem 0.85rem' }}>
                    <span style={{
                      padding: '0.15rem 0.5rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      background: 'rgba(56, 189, 248, 0.15)',
                      color: '#38bdf8',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                    }}>
                      ACTIVE SIGNAL
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
