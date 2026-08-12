import React from 'react';
import { PositionRiskSummary } from '@/types/positionMonitor';

interface PositionRiskSummaryProps {
  summary: PositionRiskSummary;
}

export const PositionRiskSummaryComp: React.FC<PositionRiskSummaryProps> = ({ summary }) => {
  const cards = [
    { label: "Open Positions", value: summary.totalPositions },
    { label: "Total Exposure", value: `₹${summary.totalExposure.toLocaleString()}` },
    { label: "Exposure %", value: `${summary.exposurePercent.toFixed(1)}%` },
    { label: "Total P&L", value: `₹${summary.totalPnl.toFixed(2)}`, color: summary.totalPnl >= 0 ? "text-emerald-400" : "text-red-400" },
    { label: "Safe", value: summary.safePositions, color: "text-emerald-400" },
    { label: "Warning", value: summary.warningPositions, color: "text-amber-400" },
    { label: "Danger", value: summary.dangerPositions, color: "text-red-400" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
      {cards.map((card, i) => (
        <div key={i} className="bg-[#1e293b] p-4 rounded-lg border border-[#334155] text-center">
          <div className="text-xs text-gray-400 mb-1">{card.label}</div>
          <div className={`text-lg font-bold ${card.color || 'text-white'}`}>{card.value}</div>
        </div>
      ))}
    </div>
  );
};
