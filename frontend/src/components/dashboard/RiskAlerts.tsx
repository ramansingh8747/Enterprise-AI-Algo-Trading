import React from 'react';
import { MonitoredPosition } from '@/types/positionMonitor';

interface RiskAlertsProps {
  positions: MonitoredPosition[];
  onSelectPosition?: (position: MonitoredPosition) => void;
}

export const RiskAlerts: React.FC<RiskAlertsProps> = ({ positions, onSelectPosition }) => {
  const alerts: { msg: string; color: string; pos?: MonitoredPosition }[] = [];

  const dangerPos = positions.find(p => p.riskStatus === 'DANGER');
  if (dangerPos) {
    alerts.push({
      msg: `Position ${dangerPos.symbol} is in DANGER risk zone.`,
      color: 'text-red-400',
      pos: dangerPos,
    });
  }

  const warningPos = positions.find(p => p.riskStatus === 'WARNING');
  if (warningPos) {
    alerts.push({
      msg: `Position ${warningPos.symbol} requires risk attention.`,
      color: 'text-amber-400',
      pos: warningPos,
    });
  }

  const totalExposurePct = positions.reduce((sum, p) => sum + p.exposurePercent, 0);
  if (totalExposurePct > 50) {
    alerts.push({
      msg: `Portfolio total exposure (${totalExposurePct.toFixed(1)}%) is high.`,
      color: 'text-amber-400',
    });
  }

  return (
    <div className="bg-[#1e293b] p-4 rounded-lg border border-[#334155]">
      <h3 className="text-white font-bold mb-2">Risk Alerts</h3>
      {alerts.length > 0 ? (
        alerts.map((a, i) => (
          <div
            key={i}
            onClick={() => a.pos && onSelectPosition?.(a.pos)}
            className={`text-sm ${a.color} mb-1 ${a.pos ? 'cursor-pointer hover:underline' : ''}`}
          >
            ⚠ {a.msg}
          </div>
        ))
      ) : (
        <div className="text-sm text-emerald-400">✓ All positions are within safety risk thresholds.</div>
      )}
    </div>
  );
};
