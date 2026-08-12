import React from 'react';
import { RiskLimits } from '@/types/risk';

interface RiskLimitsCardProps {
  limits: RiskLimits;
}

export const RiskLimitsCard: React.FC<RiskLimitsCardProps> = ({ limits }) => {
  return (
    <div className="bg-[#1e293b] p-6 rounded-lg border border-[#334155]">
      <h3 className="text-sm font-bold text-gray-400 mb-4">PAPER ACCOUNT LIMITS</h3>
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div><div className="text-gray-500">Max Order</div><div className="text-white">₹{limits.maxOrderValue.toLocaleString()}</div></div>
        <div><div className="text-gray-500">Max Position</div><div className="text-white">₹{limits.maxPositionValue.toLocaleString()}</div></div>
        <div><div className="text-gray-500">Daily Loss</div><div className="text-white">₹{limits.maxDailyLoss.toLocaleString()}</div></div>
        <div><div className="text-gray-500">Trade Risk</div><div className="text-white">{limits.maxTradeRiskPercent}%</div></div>
        <div><div className="text-gray-500">Min R:R</div><div className="text-white">{limits.minRiskRewardRatio} : 1</div></div>
      </div>
    </div>
  );
};
