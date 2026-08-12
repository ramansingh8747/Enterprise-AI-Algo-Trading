import React from 'react';
import { PerformancePoint } from '@/types/analytics';

interface PerformanceChartProps {
  data: PerformancePoint[];
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({ data }) => {
  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;
  
  const width = 800;
  const height = 280;
  const padding = 40;

  const getX = (index: number) => padding + (index * (width - 2 * padding) / (data.length - 1));
  const getY = (value: number) => height - padding - ((value - minValue) / range * (height - 2 * padding));

  const points = data.map((d, i) => `${getX(i)},${getY(d.value)}`).join(' ');
  const isPositive = data[data.length - 1].value >= data[0].value;

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-800">Portfolio Performance</h3>
      <p className="text-sm text-gray-500 mb-4">Paper Portfolio</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-64">
        <polyline
          fill="none"
          stroke={isPositive ? "#10B981" : "#EF4444"}
          strokeWidth="4"
          points={points}
        />
        {data.map((d, i) => (
          <circle key={i} cx={getX(i)} cy={getY(d.value)} r="6" fill={isPositive ? "#10B981" : "#EF4444"} />
        ))}
      </svg>
      <div className="flex justify-between mt-4 text-xs text-gray-500">
        {data.map((d, i) => <span key={i}>{d.label}</span>)}
      </div>
    </div>
  );
};
