import { MonitoredPosition } from '@/types/positionMonitor';
import { RiskIntelligenceSummary, AdvancedRiskAnalyticsSummary } from '@/types/riskPositionIntelligence';

export const calculateRiskIntelligence = (
  positions: MonitoredPosition[],
  totalPortfolioValue: number
): RiskIntelligenceSummary => {
  if (!positions || positions.length === 0) {
    return {
      healthScore: 100,
      healthStatus: 'LOW',
      totalExposure: 0,
      exposurePercent: 0,
      totalPnl: 0,
      safeCount: 0,
      warningCount: 0,
      dangerCount: 0,
      largestPosition: null,
      topRiskPosition: null,
    };
  }

  const totalExposure = positions.reduce((sum, p) => sum + (p.currentValue || 0), 0);
  const totalPnl = positions.reduce((sum, p) => sum + (p.pnl || 0), 0);
  const exposurePercent = totalPortfolioValue > 0 ? (totalExposure / totalPortfolioValue) * 100 : 0;

  const safeCount = positions.filter(p => p.riskStatus === 'SAFE').length;
  const warningCount = positions.filter(p => p.riskStatus === 'WARNING').length;
  const dangerCount = positions.filter(p => p.riskStatus === 'DANGER').length;

  let healthScore = 100;
  if (dangerCount > 0) healthScore -= dangerCount * 30;
  if (warningCount > 0) healthScore -= warningCount * 15;
  if (exposurePercent > 70) healthScore -= 20;
  healthScore = Math.max(0, healthScore);

  let healthStatus: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'LOW';
  if (healthScore < 40) healthStatus = 'CRITICAL';
  else if (healthScore < 60) healthStatus = 'HIGH';
  else if (healthScore < 80) healthStatus = 'MODERATE';

  const sortedByVal = [...positions].sort((a, b) => b.currentValue - a.currentValue);
  const largestPosition = sortedByVal[0] || null;

  const sortedByRisk = [...positions].sort((a, b) => {
    const riskRank = { DANGER: 3, WARNING: 2, SAFE: 1 };
    return riskRank[b.riskStatus] - riskRank[a.riskStatus];
  });
  const topRiskPosition = sortedByRisk[0] || null;

  return {
    healthScore,
    healthStatus,
    totalExposure,
    exposurePercent,
    totalPnl,
    safeCount,
    warningCount,
    dangerCount,
    largestPosition,
    topRiskPosition,
  };
};

export const calculateAdvancedRiskAnalytics = (
  positions: MonitoredPosition[],
  paperBalance: number,
  portfolioValue: number
): AdvancedRiskAnalyticsSummary => {
  if (!positions || positions.length === 0) {
    return {
      longExposure: 0,
      shortExposure: 0,
      longCount: 0,
      shortCount: 0,
      safePercent: 100,
      warningPercent: 0,
      dangerPercent: 0,
      capitalUtilizationPercent: 0,
    };
  }

  const longPositions = positions.filter(p => p.quantity > 0);
  const shortPositions = positions.filter(p => p.quantity < 0);

  const longExposure = longPositions.reduce((sum, p) => sum + (p.currentValue || 0), 0);
  const shortExposure = shortPositions.reduce((sum, p) => sum + Math.abs(p.currentValue || 0), 0);

  const total = positions.length;
  const safeCount = positions.filter(p => p.riskStatus === 'SAFE').length;
  const warningCount = positions.filter(p => p.riskStatus === 'WARNING').length;
  const dangerCount = positions.filter(p => p.riskStatus === 'DANGER').length;

  const safePercent = (safeCount / total) * 100;
  const warningPercent = (warningCount / total) * 100;
  const dangerPercent = (dangerCount / total) * 100;

  const totalExposure = longExposure + shortExposure;
  const capitalUtilizationPercent = portfolioValue > 0 ? (totalExposure / portfolioValue) * 100 : 0;

  return {
    longExposure,
    shortExposure,
    longCount: longPositions.length,
    shortCount: shortPositions.length,
    safePercent,
    warningPercent,
    dangerPercent,
    capitalUtilizationPercent,
  };
};
