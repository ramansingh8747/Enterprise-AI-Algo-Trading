import { RiskLimits, RiskValidationResult } from "@/types/risk";

const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxOrderValue: 100000,
  maxPositionValue: 200000,
  maxDailyLoss: 10000,
  maxTradeRiskPercent: 2,
  minRiskRewardRatio: 1.5,
};

export function getDefaultRiskLimits(): RiskLimits {
  return DEFAULT_RISK_LIMITS;
}

export function validatePaperOrderRisk(
  side: "BUY" | "SELL",
  quantity: number,
  entryPrice: number,
  stopLoss: number,
  targetPrice: number,
  balance: number,
  currentExposure: number,
  dailyPnl: number,
  limits: RiskLimits
): RiskValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const orderValue = quantity * entryPrice;
  let stopLossRisk = 0;
  let reward = 0;

  if (side === "BUY") {
    if (stopLoss >= entryPrice) errors.push("❌ Stop Loss must be below entry price for BUY orders.");
    if (targetPrice <= entryPrice) errors.push("❌ Target Price must be above entry price for BUY orders.");
    stopLossRisk = (entryPrice - stopLoss) * quantity;
    reward = (targetPrice - entryPrice) * quantity;
  } else {
    if (stopLoss <= entryPrice) errors.push("❌ Stop Loss must be above entry price for SELL orders.");
    if (targetPrice >= entryPrice) errors.push("❌ Target Price must be below entry price for SELL orders.");
    stopLossRisk = (stopLoss - entryPrice) * quantity;
    reward = (entryPrice - targetPrice) * quantity;
  }

  const riskRewardRatio = stopLossRisk > 0 ? reward / stopLossRisk : 0;
  
  if (quantity <= 0) errors.push("❌ Quantity must be greater than 0.");
  if (orderValue > limits.maxOrderValue) errors.push(`❌ Order value ₹${orderValue.toLocaleString()} exceeds maximum allowed ₹${limits.maxOrderValue.toLocaleString()}.`);
  if (currentExposure + orderValue > limits.maxPositionValue) errors.push("❌ Order would exceed maximum allowed portfolio position value.");
  if (dailyPnl <= -limits.maxDailyLoss) errors.push("❌ Daily paper trading loss limit reached.");
  if (riskRewardRatio < limits.minRiskRewardRatio) errors.push(`❌ Risk/Reward ratio must be at least ${limits.minRiskRewardRatio} : 1.`);

  if (orderValue > limits.maxOrderValue * 0.8) warnings.push("⚠ Order value is close to the configured maximum.");
  if (currentExposure + orderValue > limits.maxPositionValue * 0.8) warnings.push("⚠ Portfolio exposure is high.");
  if (dailyPnl <= -limits.maxDailyLoss * 0.8) warnings.push("⚠ Daily loss limit is almost reached.");
  if (riskRewardRatio < limits.minRiskRewardRatio * 1.2) warnings.push("⚠ Risk/reward ratio is near the minimum.");

  return {
    allowed: errors.length === 0,
    warnings,
    errors,
    riskRewardRatio: parseFloat(riskRewardRatio.toFixed(2)),
    orderValue,
    stopLossRisk,
  };
}
