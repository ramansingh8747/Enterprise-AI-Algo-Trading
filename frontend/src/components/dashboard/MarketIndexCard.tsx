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
        background: 'linear-gradient(135deg, rgba(17, 27, 45, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
        border: '1px solid rgba(148, 163, 184, 0.14)',
        borderRadius: '0.85rem',
        padding: '1.15rem 1.35rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
        backdropFilter: 'blur(8px)',
        transition: 'all 0.18s ease',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: `linear-gradient(90deg, ${color} 0%, transparent 100%)`,
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '0.02em' }}>
          {index.name}
        </span>
        <span style={{
          fontSize: '0.72rem',
          fontWeight: 800,
          color,
          background: bgBadge,
          border: `1px solid ${isPositive ? 'rgba(74, 222, 128, 0.25)' : 'rgba(248, 113, 113, 0.25)'}`,
          padding: '0.2rem 0.6rem',
          borderRadius: '1rem',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {isPositive ? '▲ +' : '▼ '}{Math.abs(index.changePercent).toFixed(2)}%
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginTop: '0.15rem' }}>
        <span style={{ fontSize: '1.55rem', fontWeight: 900, color: '#f8fafc', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
          ₹{index.value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span style={{ fontSize: '0.8rem', fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>
          {isPositive ? '+' : ''}{index.change.toFixed(2)}
        </span>
      </div>
    </div>
  );
};
