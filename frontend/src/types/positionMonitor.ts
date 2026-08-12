export type PositionRiskStatus = "SAFE" | "WARNING" | "DANGER";

export interface MonitoredPosition {
  symbol: string;
  name?: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  investedValue: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  exposurePercent: number;
  stopLoss?: number;
  targetPrice?: number;
  stopLossProgress?: number;
  targetProgress?: number;
  riskStatus: PositionRiskStatus;
  side: "LONG" | "SHORT";
}

export interface PositionRiskSummary {
  totalPositions: number;
  totalExposure: number;
  exposurePercent: number;
  totalPnl: number;
  pnlPercent: number;
  safePositions: number;
  warningPositions: number;
  dangerPositions: number;
  largestGainer?: MonitoredPosition;
  largestLoser?: MonitoredPosition;
}
