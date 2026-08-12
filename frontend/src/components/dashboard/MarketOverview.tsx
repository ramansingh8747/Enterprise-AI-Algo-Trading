import React from 'react';
import { MarketIndex } from '@/types/market';
import { initialIndices } from '@/data/marketData';

interface MarketOverviewProps {
  indices?: MarketIndex[];
}

export const MarketOverview: React.FC<MarketOverviewProps> = ({ indices = initialIndices }) => {
  return (
    <div style={{
      background: '#0f172a',
      border: '1px solid #1e293b',
      borderRadius: '0.5rem',
      padding: '0.75rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      gap: '1.5rem',
      overflowX: 'auto',
    }}>
      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        MARKET OVERVIEW
      </span>

      <div style={{ display: 'flex', gap: '2rem', flex: 1, alignItems: 'center' }}>
        {indices.map((idx, i) => {
          const isUp = idx.change >= 0;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
              <span style={{ fontWeight: 600, color: '#cbd5e1' }}>{idx.name}</span>
              <span style={{ fontWeight: 700, color: '#f8fafc' }}>{idx.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: isUp ? '#4ade80' : '#f87171',
                backgroundColor: isUp ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)',
                padding: '0.15rem 0.4rem',
                borderRadius: '0.25rem',
              }}>
                {isUp ? '+' : ''}{idx.change.toFixed(2)} ({isUp ? '+' : ''}{idx.changePercent.toFixed(2)}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MarketOverview;
