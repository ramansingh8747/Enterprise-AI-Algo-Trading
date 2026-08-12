export interface RiskLimits {
  maxOrderValue: number;
  maxPositionValue: number;
  maxDailyLoss: number;
  maxTradeRiskPercent: number;
  minRiskRewardRatio: number;
}

export interface RiskMetrics {
  paperBalance: number;
  portfolioValue: number;
  totalExposure: number;
  exposurePercent: number;
  dailyPnl: number;
  dailyLossLimit: number;
  remainingDailyLoss: number;
}

export interface RiskValidationResult {
  allowed: boolean;
  warnings: string[];
  errors: string[];
  riskRewardRatio: number;
  orderValue: number;
  stopLossRisk: number;
}
