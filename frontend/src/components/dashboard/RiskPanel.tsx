import React from 'react';
import { RiskMetrics, RiskLimits } from '@/types/risk';

interface RiskPanelProps {
  metrics: RiskMetrics;
  limits: RiskLimits;
}

export const RiskPanel: React.FC<RiskPanelProps> = ({ metrics, limits }) => {
  const getExposureColor = (percent: number) => percent > 80 ? 'text-red-400' : percent > 60 ? 'text-amber-400' : 'text-emerald-400';
  const getPnlColor = (pnl: number) => pnl < -limits.maxDailyLoss * 0.8 ? 'text-red-400' : 'text-emerald-400';

  return (
    <div className="bg-[#1e293b] p-6 rounded-lg border border-[#334155] grid grid-cols-2 md:grid-cols-4 gap-6">
      <div>
        <div className="text-xs text-gray-400">Balance / Exposure</div>
        <div className="text-white font-bold">₹{metrics.paperBalance.toLocaleString()}</div>
        <div className={`text-sm ${getExposureColor(metrics.exposurePercent)}`}>{metrics.exposurePercent.toFixed(1)}% Exposure</div>
      </div>
      <div>
        <div className="text-xs text-gray-400">Total Exposure</div>
        <div className="text-white font-bold">₹{metrics.totalExposure.toLocaleString()}</div>
      </div>
      <div>
        <div className="text-xs text-gray-400">Daily P&L</div>
        <div className={`text-xl font-bold ${getPnlColor(metrics.dailyPnl)}`}>₹{metrics.dailyPnl.toLocaleString()}</div>
      </div>
      <div>
        <div className="text-xs text-gray-400">Remaining Daily Loss</div>
        <div className="text-white font-bold">₹{metrics.remainingDailyLoss.toLocaleString()}</div>
        <div className="text-xs text-gray-500">Limit: ₹{limits.maxDailyLoss.toLocaleString()}</div>
      </div>
    </div>
  );
};
