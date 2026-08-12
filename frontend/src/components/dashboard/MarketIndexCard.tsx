import React from 'react';
import { MarketIndex } from '@/types/market';

interface MarketIndexCardProps {
  index: MarketIndex;
  onClick?: () => void;
}

export const MarketIndexCard: React.FC<MarketIndexCardProps> = ({ index, onClick }) => {
  const isPositive = index.change >= 0;
  const color = isPositive ? '#4ade80' : '#f87171';
  const bgBadge = isPositive ? 'rgba(74, 222, 128, 0.12)' : 'rgba(248, 113, 113, 0.12)';

  return (
    <div
      onClick={onClick}
      style={{
        background: '#111b2d',
        border: '1px solid rgba(148, 163, 184, 0.18)',
        borderRadius: '0.85rem',
        padding: '1.1rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s ease, border-color 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc' }}>
          {index.name}
        </span>
        <span style={{
          fontSize: '0.7rem',
          fontWeight: 800,
          color,
          background: bgBadge,
          padding: '0.15rem 0.55rem',
          borderRadius: '1rem',
        }}>
          {isPositive ? '▲' : '▼'} {Math.abs(index.changePercent).toFixed(2)}%
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
        <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f8fafc' }}>
          ₹{index.value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </span>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color }}>
          {isPositive ? '+' : ''}{index.change.toFixed(2)}
        </span>
      </div>
    </div>
  );
};
