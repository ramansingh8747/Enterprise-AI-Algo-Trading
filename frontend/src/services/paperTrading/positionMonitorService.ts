import { MonitoredPosition, PositionRiskSummary, PositionRiskStatus } from "@/types/positionMonitor";
import { PaperHolding } from "@/types/paperPortfolio";

// This is a simplification; in a real app, orders would contain SL/TP data, 
// and the service would look that up. For this demo, we assume fixed SL/TP relative to avgPrice if not set.
export function getMonitoredPositions(holdings: PaperHolding[], _portfolioValue: number): MonitoredPosition[] {
    const totalExposure = holdings.reduce((sum, h) => sum + h.currentValue, 0);

    return holdings.map(h => {
        const investedValue = h.quantity * h.averagePrice;
        const pnl = h.currentValue - investedValue;
        const pnlPercent = investedValue > 0 ? (pnl / investedValue) * 100 : 0;
        
        let riskStatus: PositionRiskStatus = "SAFE";
        if (pnlPercent <= -5 || (totalExposure > 0 && (h.currentValue / totalExposure) * 100 >= 50)) {
            riskStatus = "DANGER";
        } else if (pnlPercent <= -2 || (totalExposure > 0 && (h.currentValue / totalExposure) * 100 >= 30)) {
            riskStatus = "WARNING";
        }

        return {
            symbol: h.symbol,
            quantity: h.quantity,
            averagePrice: h.averagePrice,
            currentPrice: h.currentPrice,
            investedValue,
            currentValue: h.currentValue,
            pnl,
            pnlPercent,
            exposurePercent: totalExposure > 0 ? (h.currentValue / totalExposure) * 100 : 0,
            riskStatus,
            side: "LONG"
        };
    });
}

export function getPositionRiskSummary(positions: MonitoredPosition[], portfolioValue: number): PositionRiskSummary {
    const totalExposure = positions.reduce((sum, p) => sum + p.currentValue, 0);
    const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
    const invested = positions.reduce((sum, p) => sum + p.investedValue, 0);

    const largestGainer = [...positions].sort((a, b) => b.pnl - a.pnl)[0];
    const largestLoser = [...positions].sort((a, b) => a.pnl - b.pnl)[0];

    return {
        totalPositions: positions.length,
        totalExposure,
        exposurePercent: portfolioValue > 0 ? (totalExposure / portfolioValue) * 100 : 0,
        totalPnl,
        pnlPercent: invested > 0 ? (totalPnl / invested) * 100 : 0,
        safePositions: positions.filter(p => p.riskStatus === "SAFE").length,
        warningPositions: positions.filter(p => p.riskStatus === "WARNING").length,
        dangerPositions: positions.filter(p => p.riskStatus === "DANGER").length,
        largestGainer,
        largestLoser
    };
}
