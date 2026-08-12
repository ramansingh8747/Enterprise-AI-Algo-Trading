import { MonitoredPosition } from '@/types/positionMonitor';

export type PositionRiskFilterSide = 'ALL' | 'LONG' | 'SHORT';
export type PositionRiskFilterStatus = 'ALL' | 'SAFE' | 'WARNING' | 'DANGER';
export type PositionRiskSort = 'SYMBOL' | 'EXPOSURE' | 'PNL' | 'RISK';
export type RiskTimeRange = 'TODAY' | '7D' | '30D' | 'ALL';

export interface RiskIntelligenceSummary {
  healthScore: number;
  healthStatus: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  totalExposure: number;
  exposurePercent: number;
  totalPnl: number;
  safeCount: number;
  warningCount: number;
  dangerCount: number;
  largestPosition: MonitoredPosition | null;
  topRiskPosition: MonitoredPosition | null;
}

export interface AdvancedRiskAnalyticsSummary {
  longExposure: number;
  shortExposure: number;
  longCount: number;
  shortCount: number;
  safePercent: number;
  warningPercent: number;
  dangerPercent: number;
  capitalUtilizationPercent: number;
}
