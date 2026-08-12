import React from 'react';
import { MonitoredPosition } from '@/types/positionMonitor';

interface TopPositionsProps {
  gainer?: MonitoredPosition;
  loser?: MonitoredPosition;
}

export const TopPositions: React.FC<TopPositionsProps> = ({ gainer, loser }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {gainer && (
            <div className="bg-[#1e293b] p-4 rounded-lg border border-[#334155]">
                <h4 className="text-gray-400 text-xs">Top Gainer</h4>
                <div className="flex justify-between items-center mt-2">
                    <span className="font-bold text-white">{gainer.symbol}</span>
                    <span className="text-emerald-400 font-bold">+₹{gainer.pnl.toFixed(0)} (+{gainer.pnlPercent.toFixed(1)}%)</span>
                </div>
            </div>
        )}
        {loser && (
            <div className="bg-[#1e293b] p-4 rounded-lg border border-[#334155]">
                <h4 className="text-gray-400 text-xs">Top Loser</h4>
                <div className="flex justify-between items-center mt-2">
                    <span className="font-bold text-white">{loser.symbol}</span>
                    <span className="text-red-400 font-bold">₹{loser.pnl.toFixed(0)} ({loser.pnlPercent.toFixed(1)}%)</span>
                </div>
            </div>
        )}
    </div>
  );
};
