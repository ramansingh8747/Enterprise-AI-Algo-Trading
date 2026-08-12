import React from 'react';

interface RiskExposureChartProps {
  totalExposure: number;
  portfolioValue: number;
  exposurePercent: number;
}

export const RiskExposureChart: React.FC<RiskExposureChartProps> = ({
  totalExposure,
  portfolioValue,
  exposurePercent,
}) => {
  const cappedPercent = Math.min(100, Math.max(0, exposurePercent));
  const remainingCapacity = Math.max(0, portfolioValue - totalExposure);

  const getBarColor = (pct: number) => {
    if (pct > 75) return 'linear-gradient(90deg, #f97316 0%, #ef4444 100%)';
    if (pct > 50) return 'linear-gradient(90deg, #fbbf24 0%, #f97316 100%)';
    return 'linear-gradient(90deg, #10b981 0%, #38bdf8 100%)';
  };

  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#f8fafc' }}>
          Portfolio Exposure & Capacity
        </h3>
        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: cappedPercent > 75 ? '#ef4444' : '#38bdf8' }}>
          {cappedPercent.toFixed(1)}% Utilized
        </span>
      </div>

      {/* Progress Bar Container */}
      <div style={{
        width: '100%',
        height: '0.85rem',
        background: '#0f172a',
        borderRadius: '0.5rem',
        overflow: 'hidden',
        border: '1px solid #334155',
        marginBottom: '0.85rem',
      }}>
        <div style={{
          width: `${cappedPercent}%`,
          height: '100%',
          background: getBarColor(cappedPercent),
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Details Grid */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' }}>
        <div>
          <span>Total Exposure: </span>
          <strong style={{ color: '#f8fafc' }}>
            ₹{totalExposure.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </strong>
        </div>
        <div>
          <span>Remaining Capacity: </span>
          <strong style={{ color: '#4ade80' }}>
            ₹{remainingCapacity.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </strong>
        </div>
      </div>
    </div>
  );
};
