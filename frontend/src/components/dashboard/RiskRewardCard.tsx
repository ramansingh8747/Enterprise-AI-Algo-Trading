import React from 'react';

interface RiskRewardCardProps {
  entryPrice: number;
  stopLoss: number;
  targetPrice: number;
  side: 'BUY' | 'SELL';
  quantity: number;
}

export const RiskRewardCard: React.FC<RiskRewardCardProps> = ({ entryPrice, stopLoss, targetPrice, side: _side, quantity }) => {
  const risk = Math.abs(entryPrice - stopLoss) * quantity;
  const reward = Math.abs(targetPrice - entryPrice) * quantity;
  const rrRatio = risk > 0 ? reward / risk : 0;
  
  const getRrColor = (ratio: number) => ratio >= 1.5 ? 'text-emerald-400' : ratio >= 1.0 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="bg-[#0f172a] p-4 rounded border border-[#334155] mt-4 text-xs">
      <h4 className="font-bold text-gray-400 mb-2">Risk Check</h4>
      <div className="grid grid-cols-2 gap-2">
        <div className="text-gray-500">Risk:</div><div className="text-red-400 font-bold">₹{risk.toFixed(2)}</div>
        <div className="text-gray-500">Reward:</div><div className="text-emerald-400 font-bold">₹{reward.toFixed(2)}</div>
        <div className="text-gray-500">R:R:</div><div className={`font-bold ${getRrColor(rrRatio)}`}>{rrRatio.toFixed(2)} : 1</div>
      </div>
    </div>
  );
};
