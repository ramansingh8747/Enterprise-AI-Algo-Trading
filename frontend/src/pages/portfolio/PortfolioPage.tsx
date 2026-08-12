import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import PortfolioAllocation from "@/components/dashboard/PortfolioAllocation";
import { HoldingsTable } from "@/components/dashboard/HoldingsTable";
import { PositionsTable } from "@/components/dashboard/PositionsTable";
import { PositionMonitor } from "@/components/dashboard/PositionMonitor";
import { PositionRiskSummaryComp } from "@/components/dashboard/PositionRiskSummary";
import { TopPositions } from "@/components/dashboard/TopPositions";
import { RiskAlerts } from "@/components/dashboard/RiskAlerts";
import { PositionDetailPanel } from "@/components/dashboard/PositionDetailPanel";
import { RiskHealthOverview } from "@/components/dashboard/RiskHealthOverview";
import { PositionRiskDetail } from "@/components/dashboard/PositionRiskDetail";
import { RiskExposureChart } from "@/components/dashboard/RiskExposureChart";
import { AdvancedRiskAnalytics } from "@/components/dashboard/AdvancedRiskAnalytics";
import { PortfolioPerformanceIntelligence } from "@/components/dashboard/PortfolioPerformanceIntelligence";
import { PortfolioPerformanceQuality } from "@/components/dashboard/PortfolioPerformanceQuality";
import { PortfolioPerformanceAttribution } from "@/components/dashboard/PortfolioPerformanceAttribution";
import { PortfolioDrawdownRecovery } from "@/components/dashboard/PortfolioDrawdownRecovery";
import { PortfolioComplianceControlCenter } from "@/components/dashboard/PortfolioComplianceControlCenter";
import { PortfolioOperationalReadinessDashboard } from "@/components/dashboard/PortfolioOperationalReadinessDashboard";
import { PortfolioExecutiveIntelligenceReportCenter } from "@/components/dashboard/PortfolioExecutiveIntelligenceReportCenter";
import { PortfolioAuditExplainabilityCenter } from "@/components/dashboard/PortfolioAuditExplainabilityCenter";
import { PortfolioGovernanceReviewCenter } from "@/components/dashboard/PortfolioGovernanceReviewCenter";
import { PortfolioDecisionActionCenter } from "@/components/dashboard/PortfolioDecisionActionCenter";
import { PortfolioCorrelationDependencyMap } from "@/components/dashboard/PortfolioCorrelationDependencyMap";
import { PortfolioIntelligenceTimeline } from "@/components/dashboard/PortfolioIntelligenceTimeline";
import { PortfolioInsightDrilldown } from "@/components/dashboard/PortfolioInsightDrilldown";
import { PortfolioCommandCenterUnified } from "@/components/dashboard/PortfolioCommandCenterUnified";
import { PortfolioHealthScorecard } from "@/components/dashboard/PortfolioHealthScorecard";
import { ExecutivePortfolioCommandCenter } from "@/components/dashboard/ExecutivePortfolioCommandCenter";
import { PortfolioMonitoringEarlyWarning } from "@/components/dashboard/PortfolioMonitoringEarlyWarning";
import { PortfolioStrategyAllocation } from "@/components/dashboard/PortfolioStrategyAllocation";
import { PortfolioRiskBudget } from "@/components/dashboard/PortfolioRiskBudget";
import { PortfolioStressTest } from "@/components/dashboard/PortfolioStressTest";
import { OrderForm, OrderSide, PaperOrder } from "@/components/dashboard/OrderForm";
import { getMonitoredPositions, getPositionRiskSummary } from "@/services/paperTrading/positionMonitorService";
import { MonitoredPosition } from "@/types/positionMonitor";
import { calculateRiskIntelligence } from "@/services/paperTrading/riskPositionIntelligenceService";
import { brokerDataApi } from "@/services/api/brokerDataApi";
import { paperPortfolioApi } from "@/services/api/paperPortfolioApi";
import { BrokerHolding, BrokerPosition } from "@/types/brokerData";
import { PaperHolding, PaperPortfolio, PaperPosition, PaperPortfolioSummary } from "@/types/paperPortfolio";
import {
  INITIAL_PAPER_BALANCE,
  calculateAccountSummary,
} from "@/services/paperTrading/paperPortfolioService";
import { calculatePortfolioAnalytics } from "@/services/paperTrading/portfolioAnalyticsService";
import { PositionFilter, PositionSort } from "@/types/portfolioAnalytics";

const PAPER_HOLDINGS_KEY = "algo_trading_paper_holdings";
const PAPER_BALANCE_KEY = "algo_trading_paper_balance";
const PAPER_ORDERS_KEY = "algo_trading_paper_orders";

function formatDecimalString(value: string | undefined | null, decimals: number = 2): string {
  if (!value) return "0.00";
  const num = Number(value);
  if (isNaN(num)) return value;
  return num.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

const PortfolioPage: React.FC = () => {
  const navigate = useNavigate();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [brokerId, setBrokerId] = useState<string>("c2ce3afe-4468-49fc-9278-880111831207");
  const [holdings, setHoldings] = useState<BrokerHolding[]>([]);
  const [positions, setPositions] = useState<BrokerPosition[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [error, setError] = useState<string | null>(null);

  // Server-managed Paper Portfolio state
  const [paperPortfolios, setPaperPortfolios] = useState<PaperPortfolio[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);
  const [serverPositions, setServerPositions] = useState<PaperPosition[]>([]);
  const [serverSummary, setServerSummary] = useState<PaperPortfolioSummary | null>(null);
  const [loadingServerPortfolios, setLoadingServerPortfolios] = useState<boolean>(false);
  const [serverPortfolioError, setServerPortfolioError] = useState<string | null>(null);
  const activeRequestId = useRef<number>(0);

  // Search, Filter, Sort state for position table
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filter, setFilter] = useState<PositionFilter>('ALL');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [sort, setSort] = useState<PositionSort>('VALUE');
  const [selectedHolding, setSelectedHolding] = useState<PaperHolding | null>(null);
  const [selectedRiskPosition, setSelectedRiskPosition] = useState<MonitoredPosition | null>(null);

  // Trade Modal State
  const [tradeRequest, setTradeRequest] = useState<{
    symbol: string;
    side: OrderSide;
    price: number;
  } | null>(null);

  const [notification, setNotification] = useState<string | null>(null);

  // Paper Portfolio Fallback State
  const [paperBalance, setPaperBalance] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(PAPER_BALANCE_KEY);
      return stored ? Number(stored) : INITIAL_PAPER_BALANCE;
    } catch {
      return INITIAL_PAPER_BALANCE;
    }
  });

  // Fetch Server-managed Paper Portfolios
  const fetchServerPortfolios = useCallback(async () => {
    setLoadingServerPortfolios(true);
    setServerPortfolioError(null);
    try {
      const list = await paperPortfolioApi.listPortfolios();
      const safeList = Array.isArray(list) ? list : [];
      setPaperPortfolios(safeList);
      if (safeList.length > 0 && !selectedPortfolioId) {
        setSelectedPortfolioId(safeList[0].id);
      }
    } catch (err: any) {
      setPaperPortfolios([]);
      setServerPortfolioError(err.message || "Failed to load backend paper portfolios.");
    } finally {
      setLoadingServerPortfolios(false);
    }
  }, [selectedPortfolioId]);

  // Fetch Server-managed Portfolio Details, Positions, Summary (with Race Protection)
  const fetchServerPortfolioData = useCallback(async (portfolioId: string) => {
    const requestId = ++activeRequestId.current;
    setLoadingServerPortfolios(true);
    setServerPortfolioError(null);
    setServerPositions([]);
    setServerSummary(null);

    try {
      const [posList, summaryData] = await Promise.all([
        paperPortfolioApi.getPositions(portfolioId, true).catch(() => []),
        paperPortfolioApi.getSummary(portfolioId).catch(() => null),
      ]);

      // Guard against race condition: check if request is still current
      if (requestId === activeRequestId.current) {
        setServerPositions(posList);
        setServerSummary(summaryData);
      }
    } catch (err: any) {
      if (requestId === activeRequestId.current) {
        setServerPortfolioError(err.message || "Failed to load paper portfolio details.");
      }
    } finally {
      if (requestId === activeRequestId.current) {
        setLoadingServerPortfolios(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchServerPortfolios();
  }, [fetchServerPortfolios]);

  useEffect(() => {
    if (selectedPortfolioId) {
      fetchServerPortfolioData(selectedPortfolioId);
    }
  }, [selectedPortfolioId, fetchServerPortfolioData]);

  const fetchPortfolio = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (selectedPortfolioId) {
        await fetchServerPortfolioData(selectedPortfolioId);
      }
      const [holdData, posData] = await Promise.all([
        brokerDataApi.getHoldings(brokerId).catch(() => []),
        brokerDataApi.getPositions(brokerId).catch(() => []),
      ]);
      setHoldings(holdData);
      setPositions(posData);
    } catch (err: any) {
      setError(err.message || "Failed to load portfolio.");
    } finally {
      setLoading(false);
    }
  }, [brokerId, selectedPortfolioId, fetchServerPortfolioData]);

  const [confirmReset, setConfirmReset] = useState<boolean>(false);

  const handleResetPaperAccount = () => {
    setConfirmReset(true);
  };

  const executeResetPaperAccount = () => {
    setPaperBalance(INITIAL_PAPER_BALANCE);
    setConfirmReset(false);
    try {
      localStorage.setItem(PAPER_BALANCE_KEY, String(INITIAL_PAPER_BALANCE));
      localStorage.setItem(PAPER_HOLDINGS_KEY, JSON.stringify([]));
      localStorage.setItem(PAPER_ORDERS_KEY, JSON.stringify([]));
    } catch (_err) {
      // Ignored localStorage access error
    }
    setNotification("Paper portfolio reset successfully. Initial margin restored.");
    setTimeout(() => setNotification(null), 4000);
  };

  // Convert server positions to PaperHolding format for intelligence components
  const paperHoldings: PaperHolding[] = useMemo(() => {
    return serverPositions.map(pos => {
      const qty = Number(pos.quantity) || 0;
      const avgPx = Number(pos.average_price) || 0;
      const unPnl = Number(pos.unrealized_pnl) || 0;
      const invested = Number(pos.cost_basis) || (qty * avgPx);
      const currVal = invested + unPnl;
      const currPx = qty > 0 ? currVal / qty : avgPx;
      const pnlPercent = invested > 0 ? (unPnl / invested) * 100 : 0;
      return {
        symbol: pos.symbol,
        quantity: qty,
        averagePrice: avgPx,
        currentPrice: currPx,
        investedValue: invested,
        currentValue: currVal,
        pnl: unPnl,
        pnlPercent: pnlPercent,
      };
    });
  }, [serverPositions]);

  const paperSummary = calculateAccountSummary(paperBalance, paperHoldings);
  const analyticsSummary = useMemo(() => calculatePortfolioAnalytics(paperHoldings), [paperHoldings]);
  const monitoredPositions = useMemo(() => getMonitoredPositions(paperHoldings, paperSummary.portfolioValue), [paperHoldings, paperSummary.portfolioValue]);
  const positionSummary = useMemo(() => getPositionRiskSummary(monitoredPositions, paperSummary.portfolioValue), [monitoredPositions, paperSummary.portfolioValue]);
  const riskIntel = useMemo(() => calculateRiskIntelligence(monitoredPositions, paperSummary.portfolioValue), [monitoredPositions, paperSummary.portfolioValue]);

  // Filtered & Sorted Positions (reserved for future position table rendering)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const filteredHoldings = useMemo(() => {
    return paperHoldings.filter(h => {
      if (searchQuery.trim() && !h.symbol.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (filter === 'GAINERS') return h.pnl > 0;
      if (filter === 'LOSERS') return h.pnl < 0;
      return true;
    }).sort((a, b) => {
      if (sort === 'SYMBOL') return a.symbol.localeCompare(b.symbol);
      if (sort === 'PNL') return b.pnl - a.pnl;
      return b.currentValue - a.currentValue;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperHoldings, searchQuery, filter]);

  const allocationItems = useMemo(() => {
    const totalVal = paperHoldings.reduce((sum, h) => sum + (h.currentValue || h.investedValue || 0), 0);
    if (totalVal <= 0) return [];
    return paperHoldings.map((h) => {
      const val = h.currentValue || h.investedValue || 0;
      return {
        symbol: h.symbol,
        value: val,
        percentage: (val / totalVal) * 100,
      };
    });
  }, [paperHoldings]);

  return (
    <div style={{ color: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>
      {/* Toast Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '1.25rem',
          right: '1.25rem',
          zIndex: 100,
          background: '#064e3b',
          border: '1px solid #10b981',
          borderRadius: '0.5rem',
          padding: '0.85rem 1.25rem',
          color: '#a7f3d0',
          fontSize: '0.875rem',
          fontWeight: 600,
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}>
          <span>⚡ {notification}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            style={{ background: 'none', border: 'none', color: '#a7f3d0', cursor: 'pointer', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Paper Account Reset Confirmation Modal */}
      {confirmReset && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(2, 6, 23, 0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}>
          <div style={{
            background: '#111c2d',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '0.85rem',
            padding: '1.5rem',
            maxWidth: '420px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          }}>
            <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>⚠️</span>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>
              Reset Paper Account?
            </h3>
            <p style={{ margin: '0.5rem 0 1.25rem 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              This action will reset your simulated paper trading balance back to ₹10,00,000 and clear all paper orders and holdings.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                style={{
                  padding: '0.55rem 1.1rem',
                  borderRadius: '0.375rem',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  color: '#cbd5e1',
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeResetPaperAccount}
                style={{
                  padding: '0.55rem 1.1rem',
                  borderRadius: '0.375rem',
                  background: 'rgba(239, 68, 68, 0.25)',
                  border: '1px solid rgba(248, 113, 113, 0.35)',
                  color: '#fca5a5',
                  fontWeight: 800,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                Reset Account
              </button>
            </div>
          </div>
        </div>
      )}

      <main style={{ maxWidth: "1400px", margin: "0 auto", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 900, color: "#f8fafc" }}>
                Portfolio Intelligence
              </h1>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#38bdf8',
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                padding: '0.2rem 0.65rem',
                borderRadius: '1rem',
              }}>
                PAPER PORTFOLIO — SERVER BACKED
              </span>
            </div>
            <p style={{ margin: "0.5rem 0 0 0", color: "#94a3b8", fontSize: "0.875rem" }}>
              Monitor server-managed paper portfolios, position holdings, realized and unrealized P&L.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {/* Portfolio Switcher Dropdown */}
            {(paperPortfolios || []).length > 0 && (
              <select
                aria-label="Select Paper Portfolio"
                value={selectedPortfolioId || ""}
                onChange={(e) => setSelectedPortfolioId(e.target.value)}
                style={{
                  padding: "0.45rem 0.75rem",
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: "0.375rem",
                  color: "#f8fafc",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  outline: "none",
                }}
              >
                {paperPortfolios.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.execution_mode})
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={fetchPortfolio}
              style={{
                padding: '0.45rem 0.9rem',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '0.375rem',
                color: '#ffffff',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ↻ Refresh Portfolio
            </button>
            <button
              onClick={handleResetPaperAccount}
              style={{
                padding: "0.45rem 0.9rem",
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "0.375rem",
                color: "#fca5a5",
                fontSize: "0.8125rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ↻ Reset Paper Account
            </button>
          </div>
        </div>

        {/* Server Portfolio Summary Banner (Decimal-Safe) */}
        {serverPortfolioError && (
          <div style={{ padding: "1rem", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "0.5rem", color: "#fca5a5", fontSize: "0.875rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>⚠️ {serverPortfolioError}</span>
            <button onClick={fetchServerPortfolios} style={{ background: "#ef4444", border: "none", borderRadius: "0.25rem", color: "#fff", padding: "0.3rem 0.75rem", fontWeight: 700, cursor: "pointer", fontSize: "0.75rem" }}>
              Retry
            </button>
          </div>
        )}

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
          <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "0.75rem", padding: "1.25rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Total Realized P&L</span>
            <p style={{ margin: "0.35rem 0 0 0", fontSize: "1.5rem", fontWeight: 800, color: (Number(serverSummary?.total_realized_pnl) || 0) >= 0 ? "#4ade80" : "#f87171" }}>
              {(Number(serverSummary?.total_realized_pnl) || 0) >= 0 ? "+" : ""}₹{formatDecimalString(serverSummary?.total_realized_pnl)}
            </p>
          </div>

          <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "0.75rem", padding: "1.25rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Total Unrealized P&L</span>
            <p style={{ margin: "0.35rem 0 0 0", fontSize: "1.5rem", fontWeight: 800, color: (Number(serverSummary?.total_unrealized_pnl) || 0) >= 0 ? "#4ade80" : "#f87171" }}>
              {(Number(serverSummary?.total_unrealized_pnl) || 0) >= 0 ? "+" : ""}₹{formatDecimalString(serverSummary?.total_unrealized_pnl)}
            </p>
          </div>

          <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "0.75rem", padding: "1.25rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Total P&L</span>
            <p style={{ margin: "0.35rem 0 0 0", fontSize: "1.5rem", fontWeight: 800, color: (Number(serverSummary?.total_pnl) || 0) >= 0 ? "#4ade80" : "#f87171" }}>
              {(Number(serverSummary?.total_pnl) || 0) >= 0 ? "+" : ""}₹{formatDecimalString(serverSummary?.total_pnl)}
            </p>
          </div>

          <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "0.75rem", padding: "1.25rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Server Position Count</span>
            <p style={{ margin: "0.35rem 0 0 0", fontSize: "1.5rem", fontWeight: 800, color: "#38bdf8" }}>
              {serverSummary?.position_count ?? serverPositions.length}
            </p>
          </div>
        </section>

        {/* Portfolio Executive Intelligence Export & Report Center */}
        <PortfolioExecutiveIntelligenceReportCenter
          analytics={analyticsSummary}
          riskSummary={riskIntel}
          holdings={paperHoldings}
          paperBalance={paperBalance}
          portfolioValue={paperSummary.portfolioValue}
          onNavigate={(route) => navigate(route)}
        />

        {/* Portfolio Operational Readiness & Executive Summary Dashboard */}
        <PortfolioOperationalReadinessDashboard
          analytics={analyticsSummary}
          riskSummary={riskIntel}
          holdings={paperHoldings}
          paperBalance={paperBalance}
          portfolioValue={paperSummary.portfolioValue}
          onNavigate={(route) => navigate(route)}
        />

        {/* Portfolio Compliance Control Center */}
        <PortfolioComplianceControlCenter
          analytics={analyticsSummary}
          riskSummary={riskIntel}
          holdings={paperHoldings}
          onNavigate={(route) => navigate(route)}
        />

        {/* Portfolio Audit Explainability Center */}
        <PortfolioAuditExplainabilityCenter
          analytics={analyticsSummary}
          riskSummary={riskIntel}
          holdings={paperHoldings}
          onNavigate={(route) => navigate(route)}
        />

        {/* Portfolio Governance Review Center */}
        <PortfolioGovernanceReviewCenter
          analytics={analyticsSummary}
          riskSummary={riskIntel}
          holdings={paperHoldings}
          onNavigate={(route) => navigate(route)}
        />

        {/* Portfolio Decision Action Center */}
        <PortfolioDecisionActionCenter
          analytics={analyticsSummary}
          riskSummary={riskIntel}
          holdings={paperHoldings}
          onNavigate={(route) => navigate(route)}
        />

        {/* Portfolio Correlation Dependency Map */}
        <PortfolioCorrelationDependencyMap
          analytics={analyticsSummary}
          riskSummary={riskIntel}
          holdings={paperHoldings}
          onNavigate={(route) => navigate(route)}
        />

        {/* Portfolio Intelligence Timeline */}
        <PortfolioIntelligenceTimeline
          analytics={analyticsSummary}
          riskSummary={riskIntel}
          holdings={paperHoldings}
          onNavigate={(route) => navigate(route)}
        />

        {/* Portfolio Insight Drilldown */}
        <PortfolioInsightDrilldown
          analytics={analyticsSummary}
          riskSummary={riskIntel}
          holdings={paperHoldings}
          onNavigate={(route) => navigate(route)}
        />

        {/* Portfolio Command Center Unified */}
        <PortfolioCommandCenterUnified
          paperBalance={paperBalance}
          portfolioValue={paperSummary.portfolioValue}
          analytics={analyticsSummary}
          riskSummary={riskIntel}
          holdings={paperHoldings}
          onNavigate={(route) => navigate(route)}
        />

        {/* Portfolio Health Scorecard */}
        <PortfolioHealthScorecard
          paperBalance={paperBalance}
          portfolioValue={paperSummary.portfolioValue}
          analytics={analyticsSummary}
          riskSummary={riskIntel}
          holdings={paperHoldings}
          onNavigate={(route) => navigate(route)}
        />

        {/* Portfolio Monitoring Early Warning */}
        <PortfolioMonitoringEarlyWarning
          analytics={analyticsSummary}
          riskSummary={riskIntel}
          holdings={paperHoldings}
        />

        {/* Executive Portfolio Command Center */}
        <ExecutivePortfolioCommandCenter
          paperBalance={paperBalance}
          portfolioValue={paperSummary.portfolioValue}
          analytics={analyticsSummary}
          riskSummary={riskIntel}
          holdings={paperHoldings}
          onNavigate={(route) => navigate(route)}
        />

        {/* Portfolio Performance Quality */}
        <PortfolioPerformanceQuality
          analytics={analyticsSummary}
          holdings={paperHoldings}
        />

        {/* Portfolio Performance Attribution */}
        <PortfolioPerformanceAttribution
          analytics={analyticsSummary}
          holdings={paperHoldings}
        />

        {/* Portfolio Drawdown Recovery */}
        <PortfolioDrawdownRecovery
          paperBalance={paperBalance}
          portfolioValue={paperSummary.portfolioValue}
          unrealizedPnl={analyticsSummary.unrealizedPnl}
          holdings={paperHoldings}
        />

        {/* Portfolio Performance Intelligence */}
        <PortfolioPerformanceIntelligence
          analytics={analyticsSummary}
          holdings={paperHoldings}
          onSelectHolding={(h) => setSelectedHolding(h)}
        />

        {/* Portfolio Strategy Allocation */}
        <PortfolioStrategyAllocation holdings={paperHoldings} portfolioValue={paperSummary.portfolioValue} />

        {/* Portfolio Allocation Visualizer */}
        <PortfolioAllocation items={allocationItems} />

        {/* Position Risk & Monitor */}
        <section style={{ background: "#1e293b", borderRadius: "0.75rem", border: "1px solid #334155", padding: "1.5rem" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#38bdf8", marginBottom: "1.25rem" }}>
            Position Exposure & Risk Overview
          </h2>
          {paperHoldings.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#64748b", border: "1px dashed #334155", borderRadius: "0.5rem" }}>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#94a3b8" }}>No active server paper positions.</p>
              <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.75rem" }}>Create a paper trade from Dashboard or Watchlist to start tracking positions.</p>
              <button onClick={() => navigate(ROUTES.WATCHLIST)} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#0284c7', border: 'none', borderRadius: '0.375rem', color: '#ffffff', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
                Explore Markets
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <PortfolioRiskBudget summary={riskIntel} positions={monitoredPositions} paperBalance={paperBalance} />
              <RiskHealthOverview summary={riskIntel} paperBalance={paperBalance} />
              <RiskExposureChart
                totalExposure={riskIntel.totalExposure}
                portfolioValue={paperSummary.portfolioValue}
                exposurePercent={riskIntel.exposurePercent}
              />
              <AdvancedRiskAnalytics
                positions={monitoredPositions}
                paperBalance={paperBalance}
                portfolioValue={paperSummary.portfolioValue}
              />
              <PortfolioStressTest positions={monitoredPositions} portfolioValue={paperSummary.portfolioValue} />
              <PositionRiskSummaryComp summary={positionSummary} />
              <PositionMonitor positions={monitoredPositions} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                <TopPositions gainer={positionSummary.largestGainer} loser={positionSummary.largestLoser} />
                <RiskAlerts positions={monitoredPositions} onSelectPosition={(pos) => setSelectedRiskPosition(pos)} />
              </div>
            </div>
          )}
        </section>

        {/* Server-Backed Paper Position Table */}
        <section style={{
          background: "#1e293b",
          borderRadius: "0.75rem",
          border: "1px solid #334155",
          padding: "1.25rem",
          color: "#f8fafc",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#38bdf8" }}>
              Server Paper Positions ({serverPositions.length})
            </h2>

            {/* Controls: Search, Filter, Sort */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search symbol..."
                style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  padding: '0.4rem 0.75rem',
                  color: '#f8fafc',
                  fontSize: '0.8rem',
                  outline: 'none',
                }}
              />
              {(['ALL', 'GAINERS', 'LOSERS'] as PositionFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: '0.25rem',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    background: filter === f ? '#0284c7' : '#0f172a',
                    border: '1px solid #334155',
                    color: filter === f ? '#ffffff' : '#94a3b8',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {loadingServerPortfolios ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
              Loading server paper positions...
            </div>
          ) : serverPositions.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#64748b", border: "1px dashed #334155", borderRadius: "0.5rem" }}>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#94a3b8" }}>No paper positions found in backend portfolio.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #334155", color: "#94a3b8" }}>
                    <th style={{ padding: "0.75rem" }}>Symbol</th>
                    <th style={{ padding: "0.75rem" }}>Quantity</th>
                    <th style={{ padding: "0.75rem" }}>Avg Price</th>
                    <th style={{ padding: "0.75rem" }}>Cost Basis</th>
                    <th style={{ padding: "0.75rem" }}>Realized P&L</th>
                    <th style={{ padding: "0.75rem" }}>Unrealized P&L</th>
                    <th style={{ padding: "0.75rem" }}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {serverPositions.map((pos) => {
                    const unPnl = Number(pos.unrealized_pnl) || 0;
                    const realPnl = Number(pos.realized_pnl) || 0;
                    const isPositive = unPnl > 0;
                    const isNegative = unPnl < 0;
                    const color = isPositive ? "#4ade80" : isNegative ? "#f87171" : "#94a3b8";

                    return (
                      <tr
                        key={pos.id}
                        style={{
                          borderBottom: "1px solid #0f172a",
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <td style={{ padding: "0.75rem", fontWeight: 800, color: "#f8fafc" }}>{pos.symbol}</td>
                        <td style={{ padding: "0.75rem", color: "#cbd5e1" }}>{formatDecimalString(pos.quantity, 4)}</td>
                        <td style={{ padding: "0.75rem", color: "#cbd5e1" }}>₹{formatDecimalString(pos.average_price)}</td>
                        <td style={{ padding: "0.75rem", color: "#cbd5e1" }}>₹{formatDecimalString(pos.cost_basis)}</td>
                        <td style={{ padding: "0.75rem", color: realPnl >= 0 ? "#4ade80" : "#f87171", fontWeight: 600 }}>
                          {realPnl >= 0 ? "+" : ""}₹{formatDecimalString(pos.realized_pnl)}
                        </td>
                        <td style={{ padding: "0.75rem", fontWeight: 800, color }}>
                          {isPositive ? "+" : ""}₹{formatDecimalString(pos.unrealized_pnl)}
                        </td>
                        <td style={{ padding: "0.75rem" }}>
                          <button
                            onClick={() => setTradeRequest({ symbol: pos.symbol, side: 'SELL', price: Number(pos.average_price) })}
                            style={{
                              padding: '0.25rem 0.55rem',
                              background: 'rgba(239, 68, 68, 0.2)',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              borderRadius: '0.25rem',
                              color: '#f87171',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            Exit (SELL)
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Real Broker Portfolio (Read-Only Session) */}
        <div>
          <h2 style={{ margin: "0 0 1rem 0", fontSize: "1.25rem", fontWeight: 800, color: "#f8fafc" }}>
            Real Broker Portfolio (Read-Only Session)
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(500px, 1fr))", gap: "1.5rem" }}>
            <HoldingsTable holdings={holdings} loading={loading} />
            <PositionsTable positions={positions} loading={loading} />
          </div>
        </div>
      </main>

      {/* Position Detail Modal */}
      <PositionDetailPanel
        holding={selectedHolding}
        onClose={() => setSelectedHolding(null)}
        onTrade={(sym, side, pr) => setTradeRequest({ symbol: sym, side, price: pr })}
        onViewStrategy={() => navigate(ROUTES.STRATEGY)}
      />

      {/* Position Risk Detail Modal */}
      <PositionRiskDetail
        position={selectedRiskPosition}
        onClose={() => setSelectedRiskPosition(null)}
        onNavigate={(route) => navigate(route)}
      />

      {/* Render OrderForm modal when tradeRequest is active */}
      {tradeRequest && (
        <OrderForm
          initialSymbol={tradeRequest.symbol}
          initialSide={tradeRequest.side}
          initialPrice={tradeRequest.price}
          paperBalance={paperBalance}
          existingHoldingQty={paperHoldings.find(h => h.symbol === tradeRequest.symbol)?.quantity || 0}
          onClose={() => setTradeRequest(null)}
          onPaperOrderCreated={(order: PaperOrder) => {
            setNotification(`Paper ${order.side} order placed for ${order.symbol} @ ₹${order.price}`);
            setTradeRequest(null);
            fetchPortfolio();
            setTimeout(() => setNotification(null), 4000);
          }}
        />
      )}
    </div>
  );
};

export default PortfolioPage;
