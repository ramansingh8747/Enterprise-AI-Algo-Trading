import React from 'react';
import { MonitoredPosition } from '@/types/positionMonitor';

interface PositionMonitorProps {
  positions: MonitoredPosition[];
}

export const PositionMonitor: React.FC<PositionMonitorProps> = ({ positions }) => {
  const getRiskColor = (status: string) => status === "SAFE" ? "text-emerald-400" : status === "WARNING" ? "text-amber-400" : "text-red-400";

  return (
    <div className="overflow-x-auto bg-[#1e293b] rounded-lg border border-[#334155] p-4">
      <h3 className="text-white font-bold mb-4">Position Monitor</h3>
      <table className="w-full text-left text-xs text-gray-300">
        <thead className="text-gray-400 uppercase">
          <tr>
            <th className="p-2">Symbol</th>
            <th className="p-2">Qty</th>
            <th className="p-2">Avg</th>
            <th className="p-2">Cur</th>
            <th className="p-2">P&L</th>
            <th className="p-2">Exposure</th>
            <th className="p-2">Risk</th>
          </tr>
        </thead>
        <tbody>
          {positions.map(p => (
            <tr key={p.symbol} className="border-t border-[#334155]">
              <td className="p-2 font-bold text-white">{p.symbol}</td>
              <td className="p-2">{p.quantity}</td>
              <td className="p-2">₹{p.averagePrice.toFixed(2)}</td>
              <td className="p-2">₹{p.currentPrice.toFixed(2)}</td>
              <td className={`p-2 font-bold ${p.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {p.pnl >= 0 ? '+' : ''}{p.pnl.toFixed(2)} ({p.pnlPercent.toFixed(1)}%)
              </td>
              <td className="p-2">{p.exposurePercent.toFixed(1)}%</td>
              <td className={`p-2 font-bold ${getRiskColor(p.riskStatus)}`}>{p.riskStatus}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
